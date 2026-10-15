-- M2: 직원 명단, 고객사, 시스템, 고객 담당자, 계약, 엔지니어 배정, 접속정보(암호화)

-- ── 공통 함수 ──────────────────────────────────────────────────────
-- 관리자·엔지니어(사내 기술지원 인력)인지
create or replace function public.is_staff_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('admin', 'engineer'), false)
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 직원 명단 ──────────────────────────────────────────────────────
-- 시스템 계정이 없어도 담당 엔지니어·영업으로 지정할 수 있도록 profiles와 분리한다.
create type public.staff_kind as enum ('engineer', 'sales');

create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        public.staff_kind not null,
  department  text,
  email       text,
  profile_id  uuid unique references public.profiles (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (name, kind)
);
comment on table public.staff is '엔지니어·영업 명단. 계정이 생기면 profile_id로 연결';

-- 계정이 만들어지면 같은 이메일(없으면 같은 이름)의 직원과 연결한다.
create or replace function public.link_staff_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_kind public.staff_kind :=
    case new.role when 'sales' then 'sales'::public.staff_kind else 'engineer'::public.staff_kind end;
begin
  update public.staff s
     set profile_id = new.id, email = coalesce(s.email, new.email)
   where s.profile_id is null
     and s.kind = target_kind
     and (lower(s.email) = new.email
          or (s.email is null and s.name = new.name
              and (select count(*) from public.staff x
                    where x.name = new.name and x.kind = target_kind and x.profile_id is null) = 1));
  return new;
end;
$$;

create trigger profiles_link_staff
  after insert or update of role, name on public.profiles
  for each row execute function public.link_staff_to_profile();

-- ── 고객사 ─────────────────────────────────────────────────────────
create table public.customers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  group_name            text,
  status                text not null default 'active' check (status in ('active', 'ended')),
  business_unit         text,                 -- 영업팀
  sales_rep_id          uuid references public.staff (id) on delete set null,
  importance            text check (importance in ('상', '중', '하')),
  service_difficulty    text check (service_difficulty in ('상', '중', '하')),
  support_level         text check (support_level in ('1차', '2차')),
  remote_access         text check (remote_access in ('가능', '부분', '불가')),
  business_scope        text,                 -- 업무 범위
  products              text[] not null default '{}',
  product_versions      text,                 -- MA 시트 버전 원문
  annual_amount         bigint,               -- MA 시트 금액
  inspection_cycle_note text,                 -- 점검시기 원문 (M3에서 점검 주기로 변환)
  support_count_note    text,                 -- 지원 횟수 원문
  address               text,
  visit_procedure       text,                 -- 사이트 방문 시 출입 절차
  support_method        text,                 -- 지원 빈도·방법, 일정 조율 방식
  inspection_method     text,                 -- 정기점검 방법
  incident_procedure    text,                 -- 장애 발생 시 조치 절차
  contact_temperament   text,                 -- 고객 담당자 성향
  system_env_note       text,                 -- 대상 시스템 환경·구성
  extra_requirements    text,                 -- 계약 제품 외 추가 지원 요건
  site_notes            text,                 -- 사이트 특이사항·미해결 이슈 등
  notes                 text,                 -- 기타 메모 (MA 이슈 열)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles (id) on delete set null
);
create index customers_sales_rep_idx on public.customers (sales_rep_id);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ── 고객 담당자 ────────────────────────────────────────────────────
create table public.customer_contacts (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete cascade,
  name          text not null,
  title         text,
  organization  text,                         -- 소속 (중간업체 포함)
  phone         text,
  email         text,
  is_primary    boolean not null default false,
  is_active     boolean not null default true, -- false = 이전 담당자
  note          text,
  source        text not null default 'manual' check (source in ('manual', 'excel')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index customer_contacts_customer_idx on public.customer_contacts (customer_id);
create trigger customer_contacts_updated_at before update on public.customer_contacts
  for each row execute function public.set_updated_at();

-- ── 시스템(서버) ───────────────────────────────────────────────────
create table public.customer_systems (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers (id) on delete cascade,
  business_name  text,                        -- 업무명
  environment    text check (environment in ('운영', '개발', '기타')),
  hostname       text,
  ip_enc         text,                        -- IP:Port, 앱에서 AES-256-GCM 암호화
  os             text,
  product        text not null,               -- WAS / IHS / Jennifer / Liberty / 기타
  version        text,
  edition        text,                        -- ND / BASE
  license_count  integer check (license_count >= 0),
  cpu            text,
  memory         text,
  java_version   text,
  install_path   text,
  log_path       text,
  dump_path      text,
  note           text,
  source         text not null default 'manual' check (source in ('manual', 'excel')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index customer_systems_customer_idx on public.customer_systems (customer_id);
create trigger customer_systems_updated_at before update on public.customer_systems
  for each row execute function public.set_updated_at();

-- ── 계약 ───────────────────────────────────────────────────────────
create table public.contracts (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.customers (id) on delete set null,
  contract_no    text unique,
  contractor     text,                        -- 계약처(중간업체)
  end_user       text,
  description    text,
  start_date     date,
  end_date       date,
  period_text    text,                        -- 계약기간 원문
  amount         bigint,
  contract_type  text,                        -- MA / WA / PS / 퍼콜
  products       text,
  billing_note   text,                        -- 대가 청구 방식 메모
  sales_team     text,
  sales_rep_id   uuid references public.staff (id) on delete set null,
  auto_renew     boolean not null default false,
  note           text,
  source         text not null default 'manual' check (source in ('manual', 'excel')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index contracts_customer_idx on public.contracts (customer_id);
create trigger contracts_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();

-- ── 엔지니어 배정 ──────────────────────────────────────────────────
create table public.engineer_assignments (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  staff_id     uuid not null references public.staff (id) on delete restrict,
  role         text not null check (role in ('primary', 'secondary')),
  started_on   date not null default current_date,
  ended_on     date,                          -- 값이 있으면 이전 담당(이력)
  note         text,
  created_at   timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);
create index engineer_assignments_customer_idx on public.engineer_assignments (customer_id);
create index engineer_assignments_staff_idx on public.engineer_assignments (staff_id) where ended_on is null;
-- 고객사당 현재 정 담당은 한 명
create unique index engineer_assignments_one_primary
  on public.engineer_assignments (customer_id) where role = 'primary' and ended_on is null;

-- ── 접속정보 (암호화) ─────────────────────────────────────────────
create table public.customer_credentials (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete cascade,
  system_id     uuid references public.customer_systems (id) on delete set null,
  label         text not null,                -- 예: WAS 관리콘솔, 서버 SSH
  username_enc  text,
  password_enc  text,
  note          text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index customer_credentials_customer_idx on public.customer_credentials (customer_id);
create trigger customer_credentials_updated_at before update on public.customer_credentials
  for each row execute function public.set_updated_at();

-- 접속정보·IP 열람 기록
create table public.secret_access_logs (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  target_type  text not null check (target_type in ('credential', 'system_ip')),
  target_id    uuid not null,
  accessed_at  timestamptz not null default now()
);
create index secret_access_logs_customer_idx on public.secret_access_logs (customer_id, accessed_at desc);

-- ── 현재 사용자가 영업 담당인 고객사인지 ───────────────────────────
create or replace function public.is_my_sales_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.customers c
      join public.staff s on s.id = c.sales_rep_id
     where c.id = p_customer_id and s.profile_id = auth.uid()
  )
$$;

-- 현재 사용자가 이 고객사의 현재 담당 엔지니어인지 (접속정보 열람 권한)
create or replace function public.is_assigned_engineer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.engineer_assignments a
      join public.staff s on s.id = a.staff_id
     where a.customer_id = p_customer_id and a.ended_on is null and s.profile_id = auth.uid()
  )
$$;

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.staff                enable row level security;
alter table public.customers            enable row level security;
alter table public.customer_contacts    enable row level security;
alter table public.customer_systems     enable row level security;
alter table public.contracts            enable row level security;
alter table public.engineer_assignments enable row level security;
alter table public.customer_credentials enable row level security;
alter table public.secret_access_logs   enable row level security;

-- 직원 명단: 로그인 사용자 조회, 관리자 관리
create policy staff_select on public.staff for select to authenticated
  using (public.current_user_role() is not null);
create policy staff_admin_all on public.staff for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 고객사: 관리자·엔지니어는 전체, 영업은 담당 고객사만 조회. 수정은 관리자·엔지니어, 삭제는 관리자
create policy customers_select on public.customers for select to authenticated
  using (public.is_staff_user() or public.is_my_sales_customer(id));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.is_staff_user());
create policy customers_update on public.customers for update to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());
create policy customers_delete on public.customers for delete to authenticated
  using (public.is_admin());

-- 고객 담당자·시스템: 관리자·엔지니어만
create policy contacts_staff_all on public.customer_contacts for all to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());
create policy systems_staff_all on public.customer_systems for all to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());

-- 계약: 관리자·엔지니어 조회, 관리자만 수정
create policy contracts_select on public.contracts for select to authenticated
  using (public.is_staff_user());
create policy contracts_admin_write on public.contracts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 배정: 로그인 사용자 조회(영업도 담당 엔지니어를 볼 수 있게), 관리자만 변경
create policy assignments_select on public.engineer_assignments for select to authenticated
  using (public.current_user_role() is not null);
create policy assignments_admin_write on public.engineer_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 접속정보: 암호문만 저장된다. 목록은 관리자·엔지니어, 복호화는 서버에서 권한 확인 후 수행
create policy credentials_select on public.customer_credentials for select to authenticated
  using (public.is_staff_user());
create policy credentials_write on public.customer_credentials for all to authenticated
  using (public.is_admin() or public.is_assigned_engineer(customer_id))
  with check (public.is_admin() or public.is_assigned_engineer(customer_id));

-- 열람 기록: 관리자만 조회, 기록은 서버(service_role)에서만
create policy secret_logs_admin_select on public.secret_access_logs for select to authenticated
  using (public.is_admin());

revoke all on function public.link_staff_to_profile() from public, anon, authenticated;
