-- 배포 전 자동 테스트로 쓴 번호(#1)를 되돌린다. 실제 이슈가 없을 때만 적용된다.
do $$
begin
  if not exists (select 1 from public.issues) then
    alter table public.issues alter column number restart with 1;
  end if;
end $$;
