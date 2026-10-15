-- M6: 시스템 내 알림, 외부 발송 기록, 사용자별 수신 설정

alter table public.profiles
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_kakaowork boolean not null default true;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,               -- issue_assigned, report_uploaded, inspection_due 등
  title       text not null,
  body        text,
  link        text,                        -- 눌렀을 때 이동할 화면 (내부 경로)
  dedupe_key  text unique,                 -- 같은 알림을 두 번 보내지 않기 위한 키
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- 메일·카카오워크·Slack 발송 결과 (계정이 없는 영업 담당자에게 보낸 것도 남는다)
create table public.notification_deliveries (
  id           bigint generated always as identity primary key,
  type         text not null,
  channel      text not null check (channel in ('email', 'kakaowork', 'slack')),
  recipient    text,                       -- 이메일 또는 'team'
  title        text not null,
  status       text not null check (status in ('sent', 'failed', 'skipped')),
  error        text,
  dedupe_key   text unique,
  created_at   timestamptz not null default now()
);
create index notification_deliveries_created_idx on public.notification_deliveries (created_at desc);

alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

-- 본인 알림만 보고 읽음 처리할 수 있다. 생성은 서버(service_role)가 한다.
create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy deliveries_admin_select on public.notification_deliveries for select to authenticated
  using (public.is_admin());

-- 직원 이메일은 관리자가 관리 (staff_admin_all 정책으로 이미 가능)
