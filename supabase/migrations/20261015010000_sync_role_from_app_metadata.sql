-- Supabase Auth는 사용자 행을 먼저 만들고 app_metadata(role)를 나중에 갱신한다.
-- 그래서 insert 트리거만으로는 역할이 반영되지 않는다. app_metadata.role이 바뀌면 profiles.role도 맞춘다.

create or replace function public.sync_role_from_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role text := new.raw_app_meta_data ->> 'role';
begin
  if new_role is distinct from (old.raw_app_meta_data ->> 'role')
     and new_role in ('admin', 'engineer', 'sales') then
    update public.profiles
       set role = new_role::public.user_role
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_role_from_app_metadata();

revoke all on function public.sync_role_from_app_metadata() from public, anon, authenticated;
