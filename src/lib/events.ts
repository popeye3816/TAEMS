import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminRecipients, notify, staffRecipients } from "@/lib/notify";
import { todayKst } from "@/lib/format";

// 화면에서 일어난 일에 대한 알림. 서버 액션에서 after()로 호출해 응답을 늦추지 않는다.
// 알림 실패가 업무 처리를 막지 않도록 오류는 기록만 한다.
async function safe(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[알림] ${name} 실패`, e);
  }
}

// 결과서 업로드 → 그 고객사 영업 담당자 (같은 점검은 하루 한 번)
export function reportUploaded(inspectionId: string) {
  return safe("결과서 업로드", async () => {
    const db = createAdminClient();
    const { data: i } = await db
      .from("inspections")
      .select("id, year, month, customer:customers(name, sales_rep_id), engineer:staff(name), reports:inspection_reports(id)")
      .eq("id", inspectionId)
      .single();
    if (!i) return;
    await notify({
      type: "report_uploaded",
      title: `${i.customer.name} ${i.month}월 점검결과서가 올라왔습니다`,
      body: `파일 ${i.reports.length}개 · 담당 ${i.engineer?.name ?? "-"}. 점검결과서 화면에서 내려받아 대가 청구에 사용하세요.`,
      link: `/reports?ym=${i.year}-${String(i.month).padStart(2, "0")}`,
      recipients: await staffRecipients([i.customer.sales_rep_id]),
      dedupeKey: `report-uploaded:${i.id}:${todayKst()}`,
      team: true,
    });
  });
}

// 이슈 배정 → 담당자
export function issueAssigned(issueId: string) {
  return safe("이슈 배정", async () => {
    const db = createAdminClient();
    const { data: i } = await db
      .from("issues")
      .select("id, number, title, severity, assignee_id, assigned_at, customer:customers(name)")
      .eq("id", issueId)
      .single();
    if (!i?.assignee_id) return;
    await notify({
      type: "issue_assigned",
      title: `[${i.severity}] 이슈 #${i.number}이(가) 배정되었습니다`,
      body: `${i.customer.name} · ${i.title}`,
      link: `/issues/${i.id}`,
      recipients: await staffRecipients([i.assignee_id]),
      dedupeKey: `issue-assigned:${i.id}:${i.assignee_id}:${i.assigned_at}`,
    });
  });
}

// 긴급 이슈 접수 → 관리자 전원 + 팀 채널
export function urgentIssueReceived(issueId: string) {
  return safe("긴급 이슈", async () => {
    const db = createAdminClient();
    const { data: i } = await db
      .from("issues")
      .select("id, number, title, severity, assignee:staff(name), customer:customers(name)")
      .eq("id", issueId)
      .single();
    if (!i || i.severity !== "긴급") return;
    await notify({
      type: "issue_urgent",
      title: `🚨 긴급 이슈 #${i.number} 접수: ${i.customer.name}`,
      body: `${i.title} · 담당 ${i.assignee?.name ?? "미배정"}`,
      link: `/issues/${i.id}`,
      recipients: await adminRecipients(),
      dedupeKey: `issue-urgent:${i.id}`,
      team: true,
    });
  });
}
