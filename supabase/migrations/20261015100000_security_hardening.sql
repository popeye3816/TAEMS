-- M7: Supabase 보안·성능 점검(db advisors) 반영

-- 1) 권한 확인용 함수는 로그인한 사용자만 호출 (RLS 정책이 사용하므로 authenticated에는 남긴다)
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff_user() from public, anon;
revoke execute on function public.is_my_sales_customer(uuid) from public, anon;
revoke execute on function public.is_assigned_engineer(uuid) from public, anon;
revoke execute on function public.kb_record_view(uuid) from public, anon;
revoke execute on function public.search_kb(text, integer, boolean) from public, anon;
-- 트리거 전용 함수는 API로 호출할 필요가 없다 (트리거 실행에는 EXECUTE 권한이 필요 없음)
revoke execute on function public.profiles_before_update() from public, anon, authenticated;

-- 2) auth.uid()를 행마다 다시 계산하지 않도록 (select auth.uid())로 감싼다
alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy issue_activities_staff_insert on public.issue_activities
  with check (public.is_staff_user() and author_id = (select auth.uid()));
alter policy issue_activities_own_delete on public.issue_activities
  using (author_id = (select auth.uid()) or public.is_admin());
alter policy issue_files_own_delete on public.issue_files
  using (uploaded_by = (select auth.uid()) or public.is_admin());
alter policy kb_delete on public.kb_articles
  using (public.is_admin() or author_id = (select auth.uid()));
alter policy notifications_own_select on public.notifications using (user_id = (select auth.uid()));
alter policy notifications_own_update on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy notifications_own_delete on public.notifications using (user_id = (select auth.uid()));

-- 3) 'for all' 관리자 정책이 조회 정책과 겹치지 않도록 쓰기 동작별로 나눈다
drop policy staff_admin_all on public.staff;
create policy staff_admin_insert on public.staff for insert to authenticated with check (public.is_admin());
create policy staff_admin_update on public.staff for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy staff_admin_delete on public.staff for delete to authenticated using (public.is_admin());

drop policy contracts_admin_write on public.contracts;
create policy contracts_admin_insert on public.contracts for insert to authenticated with check (public.is_admin());
create policy contracts_admin_update on public.contracts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy contracts_admin_delete on public.contracts for delete to authenticated using (public.is_admin());

drop policy assignments_admin_write on public.engineer_assignments;
create policy assignments_admin_insert on public.engineer_assignments for insert to authenticated with check (public.is_admin());
create policy assignments_admin_update on public.engineer_assignments for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy assignments_admin_delete on public.engineer_assignments for delete to authenticated using (public.is_admin());

drop policy credentials_write on public.customer_credentials;
create policy credentials_insert on public.customer_credentials for insert to authenticated
  with check (public.is_admin() or public.is_assigned_engineer(customer_id));
create policy credentials_update on public.customer_credentials for update to authenticated
  using (public.is_admin() or public.is_assigned_engineer(customer_id))
  with check (public.is_admin() or public.is_assigned_engineer(customer_id));
create policy credentials_delete on public.customer_credentials for delete to authenticated
  using (public.is_admin() or public.is_assigned_engineer(customer_id));

drop policy report_templates_admin on public.report_templates;
create policy report_templates_admin_insert on public.report_templates for insert to authenticated with check (public.is_admin());
create policy report_templates_admin_update on public.report_templates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy report_templates_admin_delete on public.report_templates for delete to authenticated using (public.is_admin());

drop policy kb_helpful_own on public.kb_helpful;
create policy kb_helpful_own_insert on public.kb_helpful for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_staff_user());
create policy kb_helpful_own_delete on public.kb_helpful for delete to authenticated
  using (user_id = (select auth.uid()));

-- profiles 수정: 본인 정책과 관리자 정책을 하나로
drop policy profiles_update_self on public.profiles;
drop policy profiles_update_admin on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- 4) 처음 로그인하면 임시 비밀번호를 바꾸도록 표시
alter table public.profiles add column if not exists must_change_password boolean not null default false;
