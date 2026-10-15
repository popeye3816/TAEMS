-- M4: 이슈 관리 (접수 → 배정 → 처리중 → 완료)

create table public.issues (
  id              uuid primary key default gen_random_uuid(),
  number          bigint generated always as identity unique,  -- 화면 표시용 번호 (#12)
  customer_id     uuid not null references public.customers (id) on delete restrict,
  system_id       uuid references public.customer_systems (id) on delete set null,
  inspection_id   uuid references public.inspections (id) on delete set null,  -- 점검 중 발견한 이슈
  title           text not null,
  description     text,
  severity        text not null default '보통' check (severity in ('긴급', '높음', '보통', '낮음')),
  channel         text check (channel in ('전화', '메일', '메신저', '방문', '점검 중 발견', '기타')),
  requester       text,                                         -- 고객 측 요청자
  status          text not null default 'received'
                    check (status in ('received', 'assigned', 'in_progress', 'resolved')),
  assignee_id     uuid references public.staff (id) on delete set null,
  reporter_id     uuid references public.profiles (id) on delete set null,
  received_at     timestamptz not null default now(),
  assigned_at     timestamptz,
  started_at      timestamptz,
  resolved_at     timestamptz,
  cause           text,                                         -- 원인 (완료 시 필수)
  action          text,                                         -- 조치 (완료 시 필수)
  add_to_kb       boolean not null default false,               -- 지식베이스로 등록 요청 (M5)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 완료하려면 원인과 조치를 반드시 남긴다
  constraint issues_resolve_requires_cause_action check (
    status <> 'resolved'
    or (nullif(btrim(cause), '') is not null and nullif(btrim(action), '') is not null and resolved_at is not null)
  ),
  -- 배정 이후 상태는 담당자가 있어야 한다
  constraint issues_assigned_has_assignee check (status = 'received' or assignee_id is not null)
);
create index issues_status_idx on public.issues (status, received_at desc);
create index issues_customer_idx on public.issues (customer_id, received_at desc);
create index issues_assignee_idx on public.issues (assignee_id) where status <> 'resolved';
create trigger issues_updated_at before update on public.issues
  for each row execute function public.set_updated_at();

-- 댓글과 상태·담당 변경 이력
create table public.issue_activities (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references public.issues (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  kind        text not null check (kind in ('comment', 'status', 'assign', 'edit')),
  body        text,
  created_at  timestamptz not null default now()
);
create index issue_activities_issue_idx on public.issue_activities (issue_id, created_at);

-- 첨부 파일 (로그, 스크린샷 등)
create table public.issue_files (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid not null references public.issues (id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  file_size     bigint,
  content_type  text,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index issue_files_issue_idx on public.issue_files (issue_id, created_at);

insert into storage.buckets (id, name, public, file_size_limit)
values ('issue-files', 'issue-files', false, 52428800)
on conflict (id) do nothing;

-- ── RLS: 관리자·엔지니어만. 삭제는 관리자 ─────────────────────────
alter table public.issues            enable row level security;
alter table public.issue_activities  enable row level security;
alter table public.issue_files       enable row level security;

create policy issues_staff_select on public.issues for select to authenticated using (public.is_staff_user());
create policy issues_staff_insert on public.issues for insert to authenticated with check (public.is_staff_user());
create policy issues_staff_update on public.issues for update to authenticated
  using (public.is_staff_user()) with check (public.is_staff_user());
create policy issues_admin_delete on public.issues for delete to authenticated using (public.is_admin());

create policy issue_activities_staff_select on public.issue_activities for select to authenticated
  using (public.is_staff_user());
create policy issue_activities_staff_insert on public.issue_activities for insert to authenticated
  with check (public.is_staff_user() and author_id = auth.uid());
create policy issue_activities_own_delete on public.issue_activities for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

create policy issue_files_staff_select on public.issue_files for select to authenticated using (public.is_staff_user());
create policy issue_files_staff_insert on public.issue_files for insert to authenticated with check (public.is_staff_user());
create policy issue_files_own_delete on public.issue_files for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());
