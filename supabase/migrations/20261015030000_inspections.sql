-- M3: 점검 주기, 월별 점검, 표준 점검 항목, 항목별 결과, 결과서 양식·결과서 파일

-- ── 점검 주기 ──────────────────────────────────────────────────────
create table public.inspection_plans (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  cycle             text not null check (cycle in ('monthly', 'bimonthly', 'quarterly', 'half', 'yearly', 'percall')),
  months            smallint[] not null default '{}',   -- 점검하는 달 (1~12). percall이면 비어 있음
  method            text not null default '방문' check (method in ('방문', '원격', '혼합')),
  visit_months      smallint[] not null default '{}',   -- 혼합일 때 방문하는 달
  preferred_timing  text,                                -- 예: 월 하순, 20일 전
  products          text[] not null default '{}',        -- 점검 대상 제품 (비어 있으면 고객사 제품 전체)
  is_active         boolean not null default true,
  needs_review      boolean not null default false,      -- 자동 생성된 주기라 확인이 필요함
  source_note       text,                                -- 근거가 된 원문
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  check (visit_months <@ months)
);
create index inspection_plans_customer_idx on public.inspection_plans (customer_id);
create trigger inspection_plans_updated_at before update on public.inspection_plans
  for each row execute function public.set_updated_at();

-- ── 월별 점검 ──────────────────────────────────────────────────────
create table public.inspections (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.customers (id) on delete cascade,
  plan_id              uuid references public.inspection_plans (id) on delete set null,
  year                 smallint not null check (year between 2020 and 2100),
  month                smallint not null check (month between 1 and 12),
  status               text not null default 'planned'
                         check (status in ('planned', 'scheduled', 'done', 'reported', 'canceled')),
  scheduled_date       date,
  engineer_id          uuid references public.staff (id) on delete set null,
  method               text check (method in ('방문', '원격')),
  products             text[] not null default '{}',
  summary              text,                             -- 점검 요약
  findings             text,                             -- 발견사항
  follow_up            text,                             -- 후속 조치
  completed_at         timestamptz,
  reported_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.profiles (id) on delete set null
);
-- 같은 주기로 같은 달에 두 번 만들지 않는다
create unique index inspections_plan_month_uniq on public.inspections (plan_id, year, month) where plan_id is not null;
create index inspections_month_idx on public.inspections (year, month);
create index inspections_customer_idx on public.inspections (customer_id, year desc, month desc);
create index inspections_engineer_idx on public.inspections (engineer_id, year, month);
create trigger inspections_updated_at before update on public.inspections
  for each row execute function public.set_updated_at();

-- ── 표준 점검 항목 ─────────────────────────────────────────────────
create table public.checklist_templates (
  id            uuid primary key default gen_random_uuid(),
  product       text not null unique,                    -- WAS / Jennifer
  title         text not null,
  result_scale  text not null check (result_scale in ('normal_abnormal', 'oxc')),
  created_at    timestamptz not null default now()
);

create table public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.checklist_templates (id) on delete cascade,
  section      text,
  name         text not null,
  method       text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true
);
create index checklist_items_template_idx on public.checklist_items (template_id, sort_order);

-- 점검 1건 × 대상(서버 또는 전체) × 항목
create table public.inspection_results (
  id             uuid primary key default gen_random_uuid(),
  inspection_id  uuid not null references public.inspections (id) on delete cascade,
  item_id        uuid not null references public.checklist_items (id) on delete cascade,
  target_key     text not null,                          -- customer_systems.id 또는 'all'
  target_label   text,
  result         text check (result in ('정상', '비정상', 'O', 'X', 'C')),
  detail         text,
  updated_at     timestamptz not null default now(),
  unique (inspection_id, item_id, target_key)
);

-- ── 결과서 양식 · 결과서 파일 ─────────────────────────────────────
create table public.report_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  product       text,                                    -- 비어 있으면 전 제품 공통
  customer_id   uuid references public.customers (id) on delete cascade, -- 비어 있으면 회사 표준
  storage_path  text not null,
  file_name     text not null,
  version       integer not null default 1,
  is_active     boolean not null default true,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.inspection_reports (
  id               uuid primary key default gen_random_uuid(),
  inspection_id    uuid not null references public.inspections (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete cascade,
  product          text,
  storage_path     text not null,
  file_name        text not null,
  file_size        bigint,
  version          integer not null default 1,
  customer_signed  boolean not null default false,       -- 고객 확인 서명본
  uploaded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index inspection_reports_inspection_idx on public.inspection_reports (inspection_id, created_at desc);
create index inspection_reports_customer_idx on public.inspection_reports (customer_id, created_at desc);

-- 파일 저장소 (비공개). 업로드·다운로드는 서버가 권한 확인 후 발급하는 서명 URL로만 한다.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('report-templates', 'report-templates', false, 52428800),
  ('inspection-reports', 'inspection-reports', false, 52428800)
on conflict (id) do nothing;

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.inspection_plans     enable row level security;
alter table public.inspections          enable row level security;
alter table public.checklist_templates  enable row level security;
alter table public.checklist_items      enable row level security;
alter table public.inspection_results   enable row level security;
alter table public.report_templates     enable row level security;
alter table public.inspection_reports   enable row level security;

-- 점검 주기: 관리자·엔지니어 조회·수정
create policy plans_staff_all on public.inspection_plans for all to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());

-- 점검: 관리자·엔지니어 전체, 영업은 담당 고객사의 점검 조회
create policy inspections_select on public.inspections for select to authenticated
  using (public.is_staff_user() or public.is_my_sales_customer(customer_id));
create policy inspections_staff_write on public.inspections for insert to authenticated
  with check (public.is_staff_user());
create policy inspections_staff_update on public.inspections for update to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());
create policy inspections_admin_delete on public.inspections for delete to authenticated
  using (public.is_admin());

-- 표준 점검 항목: 로그인 사용자 조회, 관리자 수정
create policy checklist_templates_select on public.checklist_templates for select to authenticated
  using (public.current_user_role() is not null);
create policy checklist_templates_admin on public.checklist_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy checklist_items_select on public.checklist_items for select to authenticated
  using (public.current_user_role() is not null);
create policy checklist_items_admin on public.checklist_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 항목별 결과: 관리자·엔지니어
create policy results_staff_all on public.inspection_results for all to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());

-- 결과서 양식: 관리자·엔지니어 조회, 관리자 관리
create policy report_templates_select on public.report_templates for select to authenticated
  using (public.is_staff_user());
create policy report_templates_admin on public.report_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 결과서: 관리자·엔지니어 전체, 영업은 담당 고객사만 조회
create policy reports_select on public.inspection_reports for select to authenticated
  using (public.is_staff_user() or public.is_my_sales_customer(customer_id));
create policy reports_staff_insert on public.inspection_reports for insert to authenticated
  with check (public.is_staff_user());
create policy reports_staff_update on public.inspection_reports for update to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());
create policy reports_admin_delete on public.inspection_reports for delete to authenticated
  using (public.is_admin());

-- ── 표준 점검 항목 초기값 (2026년 실제 결과서 기준) ───────────────
with t as (
  insert into public.checklist_templates (product, title, result_scale)
  values ('Jennifer', 'Jennifer 정기점검 보고서', 'normal_abnormal')
  returning id
)
insert into public.checklist_items (template_id, section, name, method, sort_order)
select t.id, v.section, v.name, v.method, v.ord
from t, (values
  ('실시간 모니터링', '실시간 액티브 서비스 상세 모니터링', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 10),
  ('실시간 모니터링', '실시간 동시단말사용자수 모니터링', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 20),
  ('실시간 모니터링', '사용자호출패턴 대기시간(Thinktime) 모니터링', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 30),
  ('실시간 모니터링', 'JDBC 연결 수행 상태 모니터링', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 40),
  ('실시간 모니터링', '실시간 업무처리량(TPS) 모니터링', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 50),
  ('실시간 모니터링', '시스템 자원(CPU, Memory) 모니터링', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 60),
  ('실시간 모니터링', '실시간 응답시간분포 그래프', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 70),
  ('장애진단·통계분석', '예외/에러 감지', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 80),
  ('장애진단·통계분석', '통계 데이터', '제니퍼 대시보드 접속 후 정상 데이터 수집 여부 확인', 90),
  ('서버 자원', '사용 중 공간', '서버 접속 후 디스크 사용량 확인', 100),
  ('로그 점검', '서버 로그 및 데이터 확인', '서버 접속 후 로그 및 데이터 확인', 110)
) as v(section, name, method, ord);

with t as (
  insert into public.checklist_templates (product, title, result_scale)
  values ('WAS', 'IBM WebSphere WAS 정기점검 보고서', 'oxc')
  returning id
)
insert into public.checklist_items (template_id, section, name, method, sort_order)
select t.id, null, v.name, v.method, v.ord
from t, (values
  ('점검 대상 서버', '정기점검 대상 서버의 HOSTNAME / IP 확인', 10),
  ('버전 및 Fix Level', '설치된 WAS의 버전 및 FixPack Level 확인', 20),
  ('설치 경로', '설치된 WAS의 설치 경로 확인', 30),
  ('파일시스템 사용량', '설치된 WAS가 사용하는 파일시스템 사용량 확인', 40),
  ('WAS Instance', 'WAS Instance 구성 내용 확인 (dmgr, nodeagent, 서버)', 50),
  ('프로세스 상태', '기동 중인 WAS Process 상태 확인', 60),
  ('Dump 발생 유무', 'javacore·heapdump 발생 여부 확인', 70),
  ('Log 점검', '로그 경로 확인 및 상세 점검', 80)
) as v(name, method, ord);
