-- M1: 사용자 프로필과 역할(관리자/엔지니어/영업)

create type public.user_role as enum ('admin', 'engineer', 'sales');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  name        text not null,
  role        public.user_role not null default 'engineer',
  team        text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is '시스템 사용자. auth.users와 1:1';

-- ── 역할 확인 함수 (RLS 정책에서 사용) ─────────────────────────────
-- security definer로 profiles RLS를 우회해 재귀 조회를 막는다.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- ── auth.users 생성 시 프로필 자동 생성 ─────────────────────────────
-- 역할은 service_role만 쓸 수 있는 app_metadata에서만 읽는다(user_metadata는 사용자가 바꿀 수 있음).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or lower(new.email) not like '%@unipoint.co.kr' then
    raise exception '회사 이메일(@unipoint.co.kr)만 사용할 수 있습니다: %', new.email;
  end if;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'engineer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at 자동 갱신, 본인 수정 시 권한 컬럼 보호 ──────────────
create or replace function public.profiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 관리자가 아니면 역할·활성 상태·이메일을 바꿀 수 없다. (service_role은 auth.uid()가 null)
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email then
      raise exception '역할과 계정 상태는 관리자만 변경할 수 있습니다';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- 로그인한 사용자는 모두 사용자 목록을 볼 수 있다(담당자 이름 표시용).
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() is not null);

-- 본인은 이름·팀·연락처를 수정할 수 있다. 권한 컬럼은 트리거가 막는다.
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 관리자는 모든 사용자를 수정할 수 있다. 생성·삭제는 서버(service_role)에서만 한다.
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on function public.handle_new_user() from public, anon, authenticated;
