// 고객사의 점검시기 문구로 점검 주기 초안을 만든다. 점검 주기가 하나도 없는 고객사에만 만든다.
// 사용법:
//   node --env-file=.env.local scripts/import/plans.ts           미리보기
//   node --env-file=.env.local scripts/import/plans.ts --apply   적재
import { createClient } from "@supabase/supabase-js";
import { describePlan, parseCycleNote } from "../../src/lib/inspection-cycle.ts";

const APPLY = process.argv.includes("--apply");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const { data: customers, error } = await db
  .from("customers")
  .select("id, name, status, remote_access, inspection_cycle_note, inspection_plans(id)")
  .order("name");
if (error) throw error;

// 기술지원_업체정보/_공통/정기점검_일정_마스터.md (2026-08, 실제 점검 실적 대조)로 확인된 값
const CONFIRMED: Record<string, Partial<ReturnType<typeof parseCycleNote> & object>> = {
  "국회도서관": { method: "방문", needs_review: false },
  "부산국회도서관": { method: "혼합", visit_months: [3, 6, 9, 12], needs_review: false },
  "대우건설": { method: "원격", needs_review: false },
  "이수시스템": { method: "원격", needs_review: false },
  "한화생명": { method: "방문", needs_review: false },
  "한화생명금융서비스": { method: "방문", needs_review: false },
  "한화손해보험": { method: "방문", needs_review: false },
  "한국씨티은행 (인천)": { cycle: "quarterly", months: [3, 6, 9, 12], method: "방문", needs_review: false },
  "한국씨티은행 (문래동)": { cycle: "quarterly", months: [3, 6, 9, 12], method: "방문", needs_review: false },
  "동아대학교": { cycle: "quarterly", months: [3, 6, 9, 12], method: "원격", needs_review: false },
  "BNK저축은행": { cycle: "quarterly", months: [1, 4, 7, 10], method: "방문", needs_review: false },
};

const rows = [];
const skipped: string[] = [];
for (const c of customers) {
  if (c.inspection_plans.length) continue;
  const base = c.status === "active" ? parseCycleNote(c.inspection_cycle_note, c.remote_access) : null;
  const parsed = base && CONFIRMED[c.name] ? { ...base, ...CONFIRMED[c.name] } : base;
  if (!parsed) {
    skipped.push(`${c.name} (${c.status === "ended" ? "계약종료" : c.inspection_cycle_note || "점검시기 없음"})`);
    continue;
  }
  rows.push({ customer_id: c.id, ...parsed });
  console.log(`${parsed.needs_review ? "확인필요" : "        "}  ${c.name.padEnd(24)} ${describePlan(parsed)}   ← "${parsed.source_note}"`);
}
console.log(`\n주기 생성 ${rows.length}곳 (확인 필요 ${rows.filter((r) => r.needs_review).length}곳), 제외 ${skipped.length}곳: ${skipped.join(", ")}`);

if (APPLY && rows.length) {
  const { error: e } = await db.from("inspection_plans").insert(rows);
  if (e) throw e;
  console.log("적재 완료");
} else if (!APPLY) {
  console.log("실제로 넣으려면 --apply를 붙이세요.");
}
