import { Suspense } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { listStaff } from "@/lib/customers";
import { countPendingPlans, listMonthInspections } from "@/lib/inspections";
import { createClient } from "@/lib/supabase/server";
import {
  INSPECTION_STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  parseYm,
  shiftMonth,
  ym,
  type InspectionStatus,
} from "@/lib/inspection-fields";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { ActionForm, Field } from "@/components/action-form";
import { addInspection, generateMonth, updateSchedule } from "./actions";

type Props = PageProps<"/schedule">;
type Row = Awaited<ReturnType<typeof listMonthInspections>>[number];

export default function SchedulePage({ searchParams }: Props) {
  return (
    <>
      <PageHeader title="월별 일정" description="고객사별 점검 주기에 따라 월 점검을 만들고, 날짜와 담당을 정합니다." />
      <Suspense fallback={<ContentSkeleton />}>
        <Schedule searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Schedule({ searchParams }: Pick<Props, "searchParams">) {
  const user = await requireRole(pathRoles("/schedule"));
  const sp = await searchParams;
  const { year, month } = parseYm(typeof sp.ym === "string" ? sp.ym : undefined);
  const view = sp.view === "calendar" ? "calendar" : "list";
  const mine = sp.mine === "1";
  const isAdmin = user.role === "admin";

  const supabase = await createClient();
  const [all, engineers, pending, { data: customers }] = await Promise.all([
    listMonthInspections(year, month),
    listStaff("engineer"),
    countPendingPlans(year, month),
    supabase.from("customers").select("id, name").eq("status", "active").order("name"),
  ]);
  const myStaff = engineers.find((e) => e.profile_id === user.id);
  const rows = mine && myStaff ? all.filter((r) => r.engineer?.id === myStaff.id) : all;

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ ym: ym(year, month), ...(view === "calendar" ? { view } : {}), ...(mine ? { mine: "1" } : {}) });
    Object.entries(o).forEach(([k, v]) => (v === undefined ? p.delete(k) : p.set(k, v)));
    return `/schedule?${p}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={q({ ym: ym(prev.year, prev.month) })} className="btn-secondary px-2" aria-label="이전 달">
            <ChevronLeft className="size-4" />
          </Link>
          <h2 className="min-w-28 text-center text-lg font-bold">
            {year}년 {month}월
          </h2>
          <Link href={q({ ym: ym(next.year, next.month) })} className="btn-secondary px-2" aria-label="다음 달">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={q({ view: undefined })} className={clsx("btn-secondary", view === "list" && "bg-slate-100")}>
            목록
          </Link>
          <Link href={q({ view: "calendar" })} className={clsx("btn-secondary", view === "calendar" && "bg-slate-100")}>
            달력
          </Link>
          {myStaff && (
            <Link href={q({ mine: mine ? undefined : "1" })} className={clsx("btn-secondary", mine && "bg-slate-100")}>
              내 점검만
            </Link>
          )}
        </div>
      </div>

      {pending > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-blue-200 bg-blue-50/50 p-4">
          <p className="text-sm text-slate-700">
            이 달에 점검해야 하는데 아직 일정이 없는 고객사가 <strong>{pending}곳</strong> 있습니다.
          </p>
          {isAdmin ? (
            <ActionForm action={generateMonth} submitLabel={`${month}월 일정 만들기`}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          ) : (
            <p className="text-xs text-slate-500">관리자가 일정을 만들면 여기에 표시됩니다.</p>
          )}
        </div>
      )}

      <Workload rows={all} engineers={engineers} />

      {view === "calendar" ? (
        <Calendar year={year} month={month} rows={rows} />
      ) : (
        <ScheduleTable rows={rows} engineers={engineers} isAdmin={isAdmin} />
      )}

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          점검 추가 (퍼콜 지원, 추가 방문 등)
        </summary>
        <div className="mt-4">
          <ActionForm action={addInspection} submitLabel="추가" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="고객사 *" className="lg:col-span-2">
                <select name="customer_id" required defaultValue="" className="input">
                  <option value="" disabled>
                    선택
                  </option>
                  {(customers ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="날짜 *">
                <input name="scheduled_date" type="date" required className="input" />
              </Field>
              <Field label="방식">
                <select name="method" className="input">
                  <option>방문</option>
                  <option>원격</option>
                </select>
              </Field>
              <Field label="담당 (비우면 정 담당)">
                <select name="engineer_id" defaultValue="" className="input">
                  <option value="">정 담당</option>
                  {engineers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="내용" className="sm:col-span-2 lg:col-span-5">
                <input name="summary" placeholder="예: 장애 지원 요청으로 방문" className="input" />
              </Field>
            </div>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}

function Workload({ rows, engineers }: { rows: Row[]; engineers: { id: string; name: string }[] }) {
  const active = rows.filter((r) => r.status !== "canceled");
  if (active.length === 0) return null;
  const stats = engineers
    .map((e) => {
      const mine = active.filter((r) => r.engineer?.id === e.id);
      return {
        name: e.name,
        total: mine.length,
        visit: mine.filter((r) => r.method === "방문").length,
        reported: mine.filter((r) => r.status === "reported").length,
      };
    })
    .filter((s) => s.total > 0);
  const unassigned = active.filter((r) => !r.engineer).length;
  const avg = stats.reduce((a, s) => a + s.total, 0) / Math.max(stats.length, 1);

  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold text-slate-900">엔지니어별 이번 달 점검</h3>
      <div className="mt-3 flex flex-wrap gap-3">
        {stats.map((s) => {
          const heavy = stats.length > 1 && s.total >= avg * 1.5;
          return (
            <div
              key={s.name}
              className={clsx("min-w-36 rounded-lg border px-3 py-2 text-sm", heavy ? "border-amber-300 bg-amber-50" : "border-slate-200")}
            >
              <p className="font-medium">{s.name}</p>
              <p className="text-slate-600">
                {s.total}건 <span className="text-xs text-slate-500">(방문 {s.visit})</span>
              </p>
              <p className="text-xs text-slate-500">
                결과서 {s.reported}/{s.total}
              </p>
              {heavy && <p className="text-xs text-amber-800">평균보다 많음</p>}
            </div>
          );
        })}
        {unassigned > 0 && (
          <div className="min-w-36 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
            <p className="font-medium text-red-800">미배정</p>
            <p className="text-red-700">{unassigned}건</p>
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status as InspectionStatus;
  return <span className={clsx("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_STYLE[s])}>{STATUS_LABEL[s]}</span>;
}

function ScheduleTable({
  rows,
  engineers,
  isAdmin,
}: {
  rows: Row[];
  engineers: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  if (rows.length === 0) {
    return <p className="card p-8 text-center text-sm text-slate-500">이 달에 등록된 점검이 없습니다.</p>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2.5 font-medium">고객사</th>
            <th className="px-3 py-2.5 font-medium">상태</th>
            <th className="px-3 py-2.5 font-medium" colSpan={2}>
              날짜 · 방식 · 담당 · 상태 변경
            </th>
            <th className="px-3 py-2.5 font-medium">결과서</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className={clsx(r.status === "canceled" && "text-slate-400")}>
              <td className="px-3 py-2.5">
                <Link href={`/schedule/${r.id}`} className="font-medium text-blue-800 hover:underline">
                  {r.customer.name}
                </Link>
                <p className="text-xs text-slate-500">{r.products.join(", ")}</p>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2.5" colSpan={2}>
                <form action={updateSchedule} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input
                    type="date"
                    name="scheduled_date"
                    defaultValue={r.scheduled_date ?? ""}
                    aria-label="점검일"
                    className="input w-36 py-1"
                  />
                  <select name="method" defaultValue={r.method ?? "방문"} aria-label="방식" className="input w-20 py-1">
                    <option>방문</option>
                    <option>원격</option>
                  </select>
                  {isAdmin ? (
                    <select name="engineer_id" defaultValue={r.engineer?.id ?? ""} aria-label="담당" className="input w-28 py-1">
                      <option value="">미배정</option>
                      {engineers.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="w-20 text-sm">{r.engineer?.name ?? <span className="text-red-700">미배정</span>}</span>
                  )}
                  <select name="status" defaultValue={r.status} aria-label="상태" className="input w-28 py-1">
                    {INSPECTION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-secondary py-1">
                    저장
                  </button>
                </form>
              </td>
              <td className="px-3 py-2.5">
                {r.reports.length > 0 ? (
                  <span className="text-emerald-700">{r.reports.length}건</span>
                ) : ["done"].includes(r.status) ? (
                  <span className="text-amber-700">미제출</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Calendar({ year, month, rows }: { year: number; month: number; rows: Row[] }) {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const lead = first.getDay();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const byDay = new Map<number, Row[]>();
  for (const r of rows) {
    if (!r.scheduled_date) continue;
    const d = Number(r.scheduled_date.slice(8, 10));
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  const undated = rows.filter((r) => !r.scheduled_date && r.status !== "canceled");

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-w-[760px] grid-cols-7">
          {cells.map((d, i) => (
            <div key={i} className={clsx("min-h-24 border-r border-b border-slate-100 p-1.5", !d && "bg-slate-50/50")}>
              {d && <p className={clsx("text-xs", i % 7 === 0 ? "text-red-600" : "text-slate-500")}>{d}</p>}
              {d &&
                (byDay.get(d) ?? []).map((r) => (
                  <Link
                    key={r.id}
                    href={`/schedule/${r.id}`}
                    className={clsx("mt-1 block truncate rounded px-1.5 py-0.5 text-xs", STATUS_STYLE[r.status as InspectionStatus])}
                    title={`${r.customer.name} · ${r.engineer?.name ?? "미배정"} · ${r.method ?? ""}`}
                  >
                    {r.method === "방문" ? "●" : "○"} {r.customer.name}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500">● 방문 ○ 원격</p>
      {undated.length > 0 && (
        <section className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900">날짜 미정 {undated.length}건</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {undated.map((r) => (
              <Link key={r.id} href={`/schedule/${r.id}`} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                {r.customer.name} · {r.engineer?.name ?? "미배정"}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
