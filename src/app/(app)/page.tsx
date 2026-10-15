import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, requestTime, todayKst } from "@/lib/format";
import { STATUS_LABEL, STATUS_STYLE, type InspectionStatus } from "@/lib/inspection-fields";
import { overdue } from "@/lib/issue-fields";
import { ContentSkeleton } from "@/components/page-header";
import { Elapsed, IssueStatusBadge, SeverityBadge } from "@/components/issue-badges";

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{user.name}님, 안녕하세요</h1>
        <p className="mt-1 text-sm text-slate-500">
          {ROLE_LABELS[user.role]} 대시보드 · {todayKst()}
        </p>
      </div>
      {params.denied && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          해당 메뉴에 접근할 권한이 없습니다.
        </p>
      )}
      {user.role === "admin" && <AdminDashboard />}
      {user.role === "engineer" && <EngineerDashboard user={user} />}
      {user.role === "sales" && <SalesDashboard />}
    </div>
  );
}

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── 관리자 ─────────────────────────────────────────────────────────
async function AdminDashboard() {
  const supabase = await createClient();
  const today = todayKst();
  const [y, m] = today.split("-").map(Number);
  const now = requestTime();
  const [{ data: insp }, { data: issues }, { count: drafts }, { data: contracts }, { data: engineers }] = await Promise.all([
    supabase.from("inspections").select("id, status, engineer_id, customer:customers(name)").eq("year", y).eq("month", m).neq("status", "canceled"),
    supabase.from("issues").select("id, number, title, status, severity, received_at, assignee_id, customer:customers(name)").neq("status", "resolved"),
    supabase.from("kb_articles").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("contracts").select("id, end_date, description, customer:customers(id, name)").gte("end_date", today).lte("end_date", addDays(today, 60)).order("end_date"),
    supabase.from("staff").select("id, name").eq("kind", "engineer").eq("is_active", true).order("name"),
  ]);
  const ins = insp ?? [];
  const open = issues ?? [];
  const late = open.filter((i) => overdue(i, now));
  const reported = ins.filter((i) => i.status === "reported").length;
  const noReport = ins.filter((i) => i.status === "done");
  const unassigned = open.filter((i) => !i.assignee_id);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`${m}월 점검 진행`} value={`${reported} / ${ins.length}`} hint="결과서 제출 / 전체" href="/schedule" progress={ins.length ? reported / ins.length : 0} />
        <Stat label="결과서 미제출" value={noReport.length} hint="점검은 끝났지만 파일 없음" href="/reports" tone={noReport.length ? "warn" : undefined} />
        <Stat label="진행 중 이슈" value={open.length} hint={`미배정 ${unassigned.length} · 지연 ${late.length}`} href="/issues" tone={late.length ? "bad" : undefined} />
        <Stat label="KB 초안" value={drafts ?? 0} hint="검토 후 게시 필요" href="/kb?status=draft" tone={drafts ? "warn" : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="엔지니어별 이번 달 업무" href="/workload">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="py-1 font-medium">엔지니어</th><th className="font-medium">점검</th><th className="font-medium">결과서</th><th className="font-medium">진행 이슈</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(engineers ?? []).map((e) => {
                const mine = ins.filter((i) => i.engineer_id === e.id);
                const myIssues = open.filter((i) => i.assignee_id === e.id);
                if (!mine.length && !myIssues.length) return null;
                return (
                  <tr key={e.id}>
                    <td className="py-1.5 font-medium">{e.name}</td>
                    <td>{mine.length}</td>
                    <td>{mine.filter((i) => i.status === "reported").length}</td>
                    <td className={clsx(myIssues.some((i) => overdue(i, now)) && "font-medium text-red-700")}>{myIssues.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="미배정·지연 이슈" href="/issues">
          <IssueList items={[...unassigned, ...late.filter((i) => i.assignee_id)].slice(0, 8)} now={now} empty="미배정·지연 이슈가 없습니다." />
        </Panel>

        <Panel title="결과서 미제출" href={`/schedule?ym=${today.slice(0, 7)}`}>
          {noReport.length === 0 ? <Empty>모두 제출했습니다.</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {noReport.slice(0, 8).map((i) => (
                <li key={i.id}><Link href={`/schedule/${i.id}`} className="text-blue-800 hover:underline">{i.customer.name}</Link></li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="60일 안에 끝나는 계약" href="/customers">
          {(contracts ?? []).length === 0 ? <Empty>없습니다.</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {contracts!.map((k) => (
                <li key={k.id} className="flex justify-between gap-3">
                  {k.customer ? (
                    <Link href={`/customers/${k.customer.id}?tab=contracts`} className="text-blue-800 hover:underline">{k.customer.name}</Link>
                  ) : <span>{k.description}</span>}
                  <span className="text-xs text-slate-500">{k.end_date}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

// ── 엔지니어 ───────────────────────────────────────────────────────
async function EngineerDashboard({ user }: { user: CurrentUser }) {
  const supabase = await createClient();
  const today = todayKst();
  const now = requestTime();
  const { data: me } = await supabase.from("staff").select("id").eq("profile_id", user.id).maybeSingle();
  if (!me) {
    return <Empty>직원 명단에 연결되지 않은 계정입니다. 관리자에게 연결을 요청하세요.</Empty>;
  }
  const [{ data: upcoming }, { data: noReport }, { data: issues }, { data: kb }] = await Promise.all([
    supabase.from("inspections").select("id, scheduled_date, method, status, customer:customers(name)")
      .eq("engineer_id", me.id).in("status", ["planned", "scheduled"]).gte("scheduled_date", today).lte("scheduled_date", addDays(today, 14)).order("scheduled_date"),
    supabase.from("inspections").select("id, year, month, customer:customers(name)").eq("engineer_id", me.id).eq("status", "done"),
    supabase.from("issues").select("id, number, title, status, severity, received_at, assignee_id, customer:customers(name)").eq("assignee_id", me.id).neq("status", "resolved").order("received_at"),
    supabase.from("kb_articles").select("id, number, title, category, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(5),
  ]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="2주 안의 내 점검" href={`/schedule?mine=1`}>
        {(upcoming ?? []).length === 0 ? <Empty>예정된 점검이 없습니다. 날짜 미정인 점검은 월별 일정에서 확인하세요.</Empty> : (
          <ul className="space-y-2 text-sm">
            {upcoming!.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <Link href={`/schedule/${i.id}`} className="text-blue-800 hover:underline">{i.customer.name}</Link>
                <span className="text-xs text-slate-500">{i.scheduled_date} · {i.method}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="내 이슈" href={`/issues?assignee=${me.id}`}>
        <IssueList items={issues ?? []} now={now} empty="진행 중인 이슈가 없습니다." />
      </Panel>
      <Panel title="결과서를 올려야 할 점검" href="/schedule?mine=1">
        {(noReport ?? []).length === 0 ? <Empty>없습니다.</Empty> : (
          <ul className="space-y-1.5 text-sm">
            {noReport!.map((i) => (
              <li key={i.id}><Link href={`/schedule/${i.id}`} className="text-blue-800 hover:underline">{i.customer.name} {i.month}월</Link></li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="최근 지식베이스" href="/kb">
        <ul className="space-y-1.5 text-sm">
          {(kb ?? []).map((a) => (
            <li key={a.id} className="flex justify-between gap-3">
              <Link href={`/kb/${a.id}`} className="text-blue-800 hover:underline">{a.title}</Link>
              <span className="shrink-0 text-xs text-slate-500">{a.category}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ── 영업 ───────────────────────────────────────────────────────────
async function SalesDashboard() {
  const supabase = await createClient();
  const today = todayKst();
  const [y, m] = today.split("-").map(Number);
  // RLS로 담당 고객사의 점검만 조회된다
  const { data } = await supabase
    .from("inspections")
    .select("id, status, scheduled_date, customer:customers(name), reports:inspection_reports(id, file_name, created_at, customer_signed)")
    .eq("year", y).eq("month", m).neq("status", "canceled");
  const rows = (data ?? []).sort((a, b) => a.customer.name.localeCompare(b.customer.name, "ko"));
  const ready = rows.filter((r) => r.reports.length > 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label={`${m}월 결과서 제출`} value={`${ready.length} / ${rows.length}`} hint="담당 고객사 기준" href="/reports" progress={rows.length ? ready.length / rows.length : 0} />
        <Stat label="대가 청구 가능" value={ready.length} hint="결과서가 올라온 고객사" href="/reports" />
      </div>
      <Panel title={`${m}월 담당 고객사 점검`} href="/reports">
        {rows.length === 0 ? <Empty>이번 달 담당 고객사의 점검이 없습니다.</Empty> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{r.customer.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className={clsx("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_STYLE[r.status as InspectionStatus])}>{STATUS_LABEL[r.status as InspectionStatus]}</span>
                  {r.reports.map((f) => (
                    <a key={f.id} href={`/api/files/report/${f.id}`} className="text-xs text-blue-800 hover:underline">
                      {f.file_name}{f.customer_signed && " (서명본)"}
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

// ── 공통 조각 ──────────────────────────────────────────────────────
function Stat({ label, value, hint, href, tone, progress }: {
  label: string; value: ReactNode; hint?: string; href: string; tone?: "warn" | "bad"; progress?: number;
}) {
  return (
    <Link href={href} className={clsx("card block p-4 hover:border-blue-300", tone === "warn" && "border-amber-200 bg-amber-50/50", tone === "bad" && "border-red-200 bg-red-50/50")}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Link>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <Link href={href} className="text-xs text-blue-700 hover:underline">전체 보기</Link>
      </div>
      {children}
    </section>
  );
}

type IssueItem = { id: string; number: number; title: string; status: string; severity: string; received_at: string; customer: { name: string } };
function IssueList({ items, now, empty }: { items: IssueItem[]; now: number; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((i) => (
        <li key={i.id}>
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={i.severity} />
            <IssueStatusBadge status={i.status} />
            <Link href={`/issues/${i.id}`} className="text-blue-800 hover:underline">#{i.number} {i.title}</Link>
          </div>
          <p className="text-xs text-slate-500">{i.customer.name} · <Elapsed issue={i} now={now} /> · {formatDateTime(i.received_at).slice(5)}</p>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}
