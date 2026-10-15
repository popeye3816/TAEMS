-- 검색 순위: 제목에 들어간 단어를 본문보다 2배로 친다
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
           (select count(*)::int from words where strpos(lower(a.title), words.w) > 0) as title_hits,
           extensions.word_similarity(lower(coalesce(q, '')), a.search_text) as similarity,
           a.status,
           a.updated_at
    from public.kb_articles a
    where (not published_only or a.status = 'published')
  )
  select id, hits, similarity
  from scored
  where hits > 0 or similarity > 0.35
  order by hits + title_hits * 2 desc, similarity desc, (status = 'published') desc, updated_at desc
  limit lim
$$;
