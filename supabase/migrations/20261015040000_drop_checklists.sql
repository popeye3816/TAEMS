-- 점검 항목을 화면에서 입력하지 않고, 결과서·사진 파일을 올려 공유하는 방식으로 바꾼다(2026-10-15 결정).
-- 항목별 결과 입력 데이터는 없었다(0건).
drop table if exists public.inspection_results;
drop table if exists public.checklist_items;
drop table if exists public.checklist_templates;

alter table public.inspections drop column if exists findings;
alter table public.inspections drop column if exists follow_up;

-- 결과서 목록에서 사진과 문서를 구분해 보여주기 위한 파일 형식
alter table public.inspection_reports add column if not exists content_type text;
