import { Suspense } from "react";
import clsx from "clsx";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { requestTime, todayKst } from "@/lib/format";
import { shiftMonth } from "@/lib/inspection-fields";
import { ContentSkeleton, PageHeader } from "@/components/page-header";

export default function WorkloadPage() {
  return (
    <>
      <PageHeader
        title="업무량"
        description="엔지니어별 점검·이슈를 월별로 봅니다. 아직 일정을 만들지 않은 달은 점검 주기로 예상한 건수입니다."
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Workload />
      </Suspense>
    </>
  );
}

type Cell = { insp: number; visit: number; projected: boolean; issues: number };

async function Workload() {
  await requireRole(pathRoles("/workload"));
  const supabase = await createClient();
  const [ty, tm] = todayKst().split("-").map(Number);
  const months = [-3, -2, -1, 0, 1, 2, 3].map((d) => shiftMonth(ty, tm, d));
  const key = (y: number, m: number) => `${y}-${m}`;
  const from = months[0];
  const fromIso = `${from.year}-${String(from.month).padStart(2, "0")}-01`;
  const since90 = new Date(requestTime() - 90 * 86_400_000).toISOString();

  const [{ data: engineers }, { data: insp }, { data: plans }, { data: issues }, { data: resolved }, { data: assigns }] = await Promise.all([
    supabase.from("staff").select("id, name").eq("kind", "engineer").eq("is_active", true).order("name"),
    supabase.from("inspections").select("plan_id, year, month, method, engineer_id, status").gte("year", from.year).neq("status", "canceled"),
    supabase.from("inspection_plans")
      .select("id, cycle, months, method, visit_months, customer:customers!inner(status, assignments:engineer_assignments(staff_id, role, ended_on))")
      .eq("is_active", true).neq("cycle", "percall").eq("customer.status", "active"),
    supabase.from("issues").select("assignee_id, received_at, status").gte("received_at", fromIso),
    supabase.from("issues").select("assignee_id, received_at, resolved_at").eq("status", "resolved").gte("resolved_at", since90),
    supabase.from("engineer_assignments").select("staff_id, role, customer:customers(status, support_level)").is("ended_on", null),
  ]);

  const grid = new Map<string, Cell>(); // `${staffId}|${y}-${m}`
  const cell = (s: string, y: number, m: number) => {
    const k = `${s}|${key(y, m)}`;
    if (!grid.has(k)) grid.set(k, { insp: 0, visit: 0, projected: false, issues: 0 });
    return grid.get(k)!;
  };
  const inRange = new Set(months.map((x) => key(x.year, x.month)));

  // 실제 만든 점검
  const generated = new Set<string>();
  for (const i of insp ?? []) {
    if (!inRange.has(key(i.year, i.month)) || !i.engineer_id) continue;
    const c = cell(i.engineer_id, i.year, i.month);
    c.insp++;
    if (i.method === "방문") c.visit++;
    if (i.plan_id) generated.add(`${i.plan_id}|${key(i.year, i.month)}`);
  }
  // 아직 만들지 않은 이번 달 이후는 점검 주기로 예상
  for (const p of plans ?? []) {
    const primary = p.customer.assignments.find((a) => a.role === "primary" && a.ended_on === null);
    if (!primary) continue;
    for (const mo of months.slice(3)) {
      if (!p.months.includes(mo.month) || generated.has(`${p.id}|${key(mo.year, mo.month)}`)) continue;
      const c = cell(primary.staff_id, mo.year, mo.month);
      c.insp++;
      c.projected = true;
      if (p.method === "방문" || (p.method === "혼합" && p.visit_months.includes(mo.month))) c.visit++;
    }
  }
  for (const i of issues ?? []) {
    if (!i.assignee_id) continue;
    const d = new Date(i.received_at);
    const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" })
      .format(d).split("-").map(Number);
    if (inRange.has(key(y, m))) cell(i.assignee_id, y, m).issues++;
  }

  const maxInsp = Math.max(1, ...[...grid.values()].map((c) => c.insp));
  const monthTotals = months.map((mo) =>
    (engineers ?? []).reduce((sum, e) => sum + (grid.get(`${e.id}|${key(mo.year, mo.month)}`)?.insp ?? 0), 0),
  );
  const avgTotal = monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length;

  const stats = (engineers ?? []).map((e) => {
    const res = (resolved ?? []).filter((r) => r.assignee_id === e.id && r.resolved_at);
    const hours = res.map((r) => (Date.parse(r.resolved_at!) - Date.parse(r.received_at)) / 3_600_000);
    const mine = (assigns ?? []).filter((a) => a.staff_id === e.id && a.customer?.status === "active");
    return {
      id: e.id,
      name: e.name,
      primary: mine.filter((a) => a.role === "primary").length,
      level2: mine.filter((a) => a.role === "primary" && a.customer?.support_level === "2차").length,
      openIssues: (issues ?? []).filter((i) => i.assignee_id === e.id && i.status !== "resolved").length,
      resolved90: res.length,
      avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    };
  });

  return (
    <div className="space-y-6">
      <section className="card overflow-x-auto p-5">
        <h2 className="text-sm font-semibold text-slate-900">월별 점검 건수 (방문)</h2>
        <p className="mt-0.5 text-xs text-slate-500">색이 진할수록 많습니다. <span className="italic">기울임</span>은 점검 주기로 예상한 값, 아래 줄 숫자는 그 달에 맡은 이슈 수입니다.</p>
        <table className="mt-3 w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="py-1 text-left font-medium">엔지니어</th>
              {months.map((mo, i) => (
                <th key={i} className={clsx("px-1 py-1 text-center font-medium", i === 3 && "text-blue-800")}>
                  {mo.month}월{i === 3 && " (이번 달)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(engineers ?? []).map((e) => (
              <tr key={e.id}>
                <td className="py-1 pr-2 font-medium">{e.name}</td>
                {months.map((mo, i) => {
                  const c = grid.get(`${e.id}|${key(mo.year, mo.month)}`);
                  const ratio = (c?.insp ?? 0) / maxInsp;
                  return (
                    <td key={i} className="p-0.5">
                      <div
                        className={clsx("rounded px-2 py-1.5 text-center", c?.projected && "italic", ratio > 0.6 ? "text-white" : "text-slate-800")}
                        style={{ backgroundColor: c?.insp ? `rgba(29, 78, 216, ${0.12 + ratio * 0.78})` : "#f8fafc" }}
                        title={c ? `점검 ${c.insp} (방문 ${c.visit}) · 이슈 ${c.issues}` : "없음"}
                      >
                        <span className="font-semibold">{c?.insp ?? 0}</span>
                        <span className="text-xs opacity-80"> ({c?.visit ?? 0})</span>
                        <div className="text-[11px] opacity-80">이슈 {c?.issues ?? 0}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-slate-200 text-xs text-slate-600">
              <td className="py-1.5 font-medium">합계</td>
              {monthTotals.map((t, i) => (
                <td key={i} className={clsx("text-center", t >= avgTotal * 1.4 && "font-bold text-red-700")}>
                  {t}
                  {t >= avgTotal * 1.4 && " 피크"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-sm font-semibold text-slate-900">엔지니어별 현황</h2>
        <table className="mt-3 w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1 font-medium">엔지니어</th>
              <th className="font-medium">정 담당 고객사</th>
              <th className="font-medium">그중 2차(고급)</th>
              <th className="font-medium">진행 중 이슈</th>
              <th className="font-medium">최근 90일 완료</th>
              <th className="font-medium">평균 처리시간</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.map((s) => (
              <tr key={s.id}>
                <td className="py-2 font-medium">{s.name}</td>
                <td>{s.primary}곳</td>
                <td>{s.level2}곳</td>
                <td>{s.openIssues}건</td>
                <td>{s.resolved90}건</td>
                <td>{s.avgHours == null ? "—" : s.avgHours < 48 ? `${Math.round(s.avgHours)}시간` : `${(s.avgHours / 24).toFixed(1)}일`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
