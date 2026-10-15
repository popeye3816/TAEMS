-- M5: 지식베이스 (문제 해결 사례 + 가이드 문서), 검색, 도움됨 표시

create extension if not exists pg_trgm with schema extensions;

create table public.kb_articles (
  id               uuid primary key default gen_random_uuid(),
  number           bigint generated always as identity unique,
  kind             text not null default 'case' check (kind in ('case', 'guide')), -- 사례(증상·원인·해결) / 가이드(본문)
  status           text not null default 'draft' check (status in ('draft', 'published')),
  title            text not null,
  category         text not null default '기타' check (category in ('WAS', 'APM', 'OS', 'DB', '네트워크', '보안', '기타')),
  product          text,            -- WebSphere 9.0, Jennifer 5.6 등
  symptom          text,            -- 증상 (사례)
  cause            text,            -- 원인 (사례)
  solution         text,            -- 해결 방법 (사례)
  content          text,            -- 본문 마크다운 (가이드)
  environment      text,            -- 환경 (OS, 구성 등)
  tags             text[] not null default '{}',
  customer_id      uuid references public.customers (id) on delete set null,
  source_issue_id  uuid unique references public.issues (id) on delete set null,
  source_note      text,            -- 가져온 원본 (파일명 등)
  author_id        uuid references public.profiles (id) on delete set null,
  updated_by       uuid references public.profiles (id) on delete set null,
  view_count       integer not null default 0,
  search_text      text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index kb_articles_search_idx on public.kb_articles using gin (search_text extensions.gin_trgm_ops);
create index kb_articles_status_idx on public.kb_articles (status, updated_at desc);

-- 검색용 문자열을 저장 시점에 만든다 (소문자)
create or replace function public.kb_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(' ',
    new.title, new.category, new.product, new.symptom, new.cause, new.solution,
    new.content, new.environment, array_to_string(new.tags, ' ')));
  new.updated_at := now();
  return new;
end;
$$;
create trigger kb_articles_search before insert or update on public.kb_articles
  for each row execute function public.kb_set_search_text();

-- 도움됨 표시 (사용자당 문서 하나에 한 번)
create table public.kb_helpful (
  article_id  uuid not null references public.kb_articles (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (article_id, user_id)
);

-- 검색: 단어별로 포함 여부를 세고, 오타·어순 차이는 trigram 유사도로 보완한다.
-- RLS가 그대로 적용되도록 security invoker로 둔다.
create or replace function public.search_kb(q text, lim integer default 30, published_only boolean default false)
returns table (id uuid, hits integer, similarity real)
language sql
stable
set search_path = ''
as $$
  with words as (
    select distinct w from unnest(regexp_split_to_array(lower(btrim(coalesce(q, ''))), '\s+')) as w
    where char_length(w) >= 2
  ),
  scored as (
    select a.id,
           (select count(*)::int from words where strpos(a.search_text, words.w) > 0) as hits,
           extensions.word_similarity(lower(coalesce(q, '')), a.search_text) as similarity,
           a.updated_at
    from public.kb_articles a
    where (not published_only or a.status = 'published')
  )
  select id, hits, similarity
  from scored
  where hits > 0 or similarity > 0.35
  order by hits desc, similarity desc, updated_at desc
  limit lim
$$;

-- 조회수 (누구나 올릴 수 있도록 함수로만 갱신)
create or replace function public.kb_record_view(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kb_articles set view_count = view_count + 1 where id = p_id and public.is_staff_user();
$$;

-- ── RLS: 관리자·엔지니어 ──────────────────────────────────────────
alter table public.kb_articles enable row level security;
alter table public.kb_helpful  enable row level security;

create policy kb_staff_select on public.kb_articles for select to authenticated using (public.is_staff_user());
create policy kb_staff_insert on public.kb_articles for insert to authenticated with check (public.is_staff_user());
create policy kb_staff_update on public.kb_articles for update to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());
create policy kb_delete on public.kb_articles for delete to authenticated
  using (public.is_admin() or author_id = auth.uid());

create policy kb_helpful_select on public.kb_helpful for select to authenticated using (public.is_staff_user());
create policy kb_helpful_own on public.kb_helpful for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_staff_user());

-- ── 이미 완료된 이슈 중 'KB 등록'을 요청한 것은 초안으로 만든다 ─────
insert into public.kb_articles (kind, status, title, category, product, symptom, cause, solution, customer_id,
                                source_issue_id, author_id, source_note)
select 'case', 'draft', i.title,
       case when s.product in ('WAS', 'IHS', 'Liberty') then 'WAS' when s.product = 'Jennifer' then 'APM' else '기타' end,
       nullif(concat_ws(' ', s.product, s.version), ''),
       i.description, i.cause, i.action, i.customer_id, i.id, i.reporter_id, '이슈 #' || i.number
from public.issues i
left join public.customer_systems s on s.id = i.system_id
where i.status = 'resolved' and i.add_to_kb
on conflict (source_issue_id) do nothing;
