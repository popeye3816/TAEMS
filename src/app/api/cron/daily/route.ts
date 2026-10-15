import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminRecipients, notify, staffRecipients, type Recipient } from "@/lib/notify";
import { overdue } from "@/lib/issue-fields";
import { todayKst } from "@/lib/format";

// 매일 아침 8시(한국 시간) Vercel Cron이 호출한다. vercel.json 참고.
// CRON_SECRET이 맞는 요청만 처리한다. 같은 날 다시 호출돼도 알림은 한 번만 간다.
export const maxDuration = 60;

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("권한이 없습니다.", { status: 401 });
  }
  const db = createAdminClient();
  const today = todayKst();
  const [y, m] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const admins = await adminRecipients();
  const result: Record<string, number> = {};

  // 1) 점검 D-3 → 담당 엔지니어
  const d3 = addDays(today, 3);
  const { data: soon } = await db
    .from("inspections")
    .select("id, scheduled_date, method, engineer_id, customer:customers(name, visit_procedure)")
    .eq("scheduled_date", d3)
    .in("status", ["planned", "scheduled"]);
  for (const i of soon ?? []) {
    await notify({
      type: "inspection_due",
      title: `3일 뒤 점검: ${i.customer.name} (${i.scheduled_date}, ${i.method ?? ""})`,
      body: i.method === "방문" && i.customer.visit_procedure ? `출입 절차: ${i.customer.visit_procedure.slice(0, 200)}` : null,
      link: `/schedule/${i.id}`,
      recipients: await staffRecipients([i.engineer_id]),
      dedupeKey: `inspection-d3:${i.id}`,
    });
  }
  result.점검_D3 = soon?.length ?? 0;

  // 2) 지연 이슈 → 담당자별 목록, 관리자에게 전체 요약
  const { data: open } = await db
    .from("issues")
    .select("id, number, title, status, severity, received_at, assignee_id, customer:customers(name)")
    .neq("status", "resolved");
  const now = Date.now();
  const late = (open ?? []).filter((i) => overdue(i, now));
  const byAssignee = new Map<string, typeof late>();
  for (const i of late) if (i.assignee_id) byAssignee.set(i.assignee_id, [...(byAssignee.get(i.assignee_id) ?? []), i]);
  for (const [staffId, list] of byAssignee) {
    await notify({
      type: "issue_overdue",
      title: `처리 기준을 넘긴 내 이슈 ${list.length}건`,
      body: list.map((i) => `#${i.number} [${i.severity}] ${i.customer.name} · ${i.title}`).join("\n"),
      link: "/issues",
      recipients: await staffRecipients([staffId]),
      dedupeKey: `issue-overdue-mine:${today}`,
    });
  }
  if (late.length) {
    await notify({
      type: "issue_overdue",
      title: `지연 이슈 ${late.length}건 (미배정 ${late.filter((i) => !i.assignee_id).length}건)`,
      body: late.slice(0, 15).map((i) => `#${i.number} [${i.severity}] ${i.customer.name} · ${i.title}`).join("\n"),
      link: "/issues",
      recipients: admins,
      dedupeKey: `issue-overdue-admin:${today}`,
    });
  }
  result.지연_이슈 = late.length;

  // 3) 월말 3일 전부터: 이번 달 점검 미완료·결과서 미제출
  if (Number(today.slice(8, 10)) >= lastDay - 2) {
    const { data: pending } = await db
      .from("inspections")
      .select("id, status, engineer_id, customer:customers(name)")
      .eq("year", y)
      .eq("month", m)
      .in("status", ["planned", "scheduled", "done"]);
    const byEngineer = new Map<string, NonNullable<typeof pending>>();
    for (const i of pending ?? []) if (i.engineer_id) byEngineer.set(i.engineer_id, [...(byEngineer.get(i.engineer_id) ?? []), i]);
    const label = (s: string) => (s === "done" ? "결과서 미제출" : "점검 미완료");
    for (const [staffId, list] of byEngineer) {
      await notify({
        type: "month_end",
        title: `${m}월 마감 전 확인: 남은 점검 ${list.length}건`,
        body: list.map((i) => `${i.customer.name} — ${label(i.status)}`).join("\n"),
        link: `/schedule?ym=${today.slice(0, 7)}&mine=1`,
        recipients: await staffRecipients([staffId]),
        dedupeKey: `month-end:${today}`,
      });
    }
    if (pending?.length) {
      await notify({
        type: "month_end",
        title: `${m}월 마감 전: 점검 미완료·결과서 미제출 ${pending.length}건`,
        body: pending.slice(0, 20).map((i) => `${i.customer.name} — ${label(i.status)}`).join("\n"),
        link: `/schedule?ym=${today.slice(0, 7)}`,
        recipients: admins,
        dedupeKey: `month-end-admin:${today}`,
      });
    }
    result.월말_미완료 = pending?.length ?? 0;
  }

  // 4) 계약 만료 60일 전 → 영업 담당 + 관리자
  const d60 = addDays(today, 60);
  const { data: expiring } = await db
    .from("contracts")
    .select("id, contract_no, end_date, description, sales_rep_id, customer:customers(id, name)")
    .eq("end_date", d60);
  for (const k of expiring ?? []) {
    const rcpt: Recipient[] = [...(await staffRecipients([k.sales_rep_id])), ...admins];
    await notify({
      type: "contract_expiring",
      title: `계약 만료 60일 전: ${k.customer?.name ?? k.description} (${k.end_date})`,
      body: `${k.contract_no} · ${k.description ?? ""}`,
      link: k.customer ? `/customers/${k.customer.id}?tab=contracts` : "/customers",
      recipients: rcpt,
      dedupeKey: `contract-60:${k.id}`,
    });
  }
  result.계약_만료예정 = expiring?.length ?? 0;

  // 5) 팀 채널 아침 요약
  const { count: todayCount } = await db
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .eq("scheduled_date", today)
    .neq("status", "canceled");
  await notify({
    type: "daily_summary",
    title: `[${today}] 오늘 점검 ${todayCount ?? 0}건 · 진행 중 이슈 ${open?.length ?? 0}건 · 지연 ${late.length}건`,
    link: "/",
    recipients: [],
    dedupeKey: `daily-summary:${today}`,
    team: true,
  });

  return NextResponse.json({ ok: true, date: today, ...result });
}
