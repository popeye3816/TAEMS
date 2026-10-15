import { Suspense } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { listStaff } from "@/lib/customers";
import { listIssues, type IssueRow } from "@/lib/issues";
import { createClient } from "@/lib/supabase/server";
import { ISSUE_STATUSES, ISSUE_STATUS_LABEL, SEVERITIES, overdue } from "@/lib/issue-fields";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { formatDateTime, requestTime } from "@/lib/format";
import { Elapsed, IssueStatusBadge, SeverityBadge } from "@/components/issue-badges";

type Props = PageProps<"/issues">;

export default function IssuesPage({ searchParams }: Props) {
  return (
    <>
      <PageHeader
        title="이슈"
        description="장애·문의를 접수부터 완료까지 관리합니다. 완료할 때 남긴 원인·조치는 지식으로 쌓입니다."
        actions={
          <Link href="/issues/new" className="btn-primary">
            <Plus className="size-4" aria-hidden /> 이슈 등록
          </Link>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Issues searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const p = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

async function Issues({ searchParams }: Pick<Props, "searchParams">) {
  const user = await requireRole(pathRoles("/issues"));
  const sp = await searchParams;
  const filters = { q: p(sp.q), status: p(sp.status), customer: p(sp.customer), assignee: p(sp.assignee), severity: p(sp.severity) };
  const view = sp.view === "board" ? "board" : "list";

  const supabase = await createClient();
  const [engineers, { data: customers }] = await Promise.all([
    listStaff("engineer"),
    supabase.from("customers").select("id, name").order("name"),
  ]);
  const me = engineers.find((e) => e.profile_id === user.id);
  // 보드 보기는 완료까지 한눈에 보도록 기본으로 전체 상태를 가져온다
  const rows = await listIssues(view === "board" && !filters.status ? { ...filters, status: "all" } : filters);
  const now = requestTime();
  const lateCount = rows.filter((r) => overdue(r, now)).length;
  const href = (o: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries({ ...filters, view: view === "board" ? "board" : undefined, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/issues${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <form className="card flex flex-wrap items-end gap-3 p-4" role="search">
        {view === "board" && <input type="hidden" name="view" value="board" />}
        <label className="min-w-44 flex-1 space-y-1 text-sm">
          <span className="text-slate-600">검색 (제목·내용·번호)</span>
          <input name="q" defaultValue={filters.q} className="input" />
        </label>
        <Sel name="status" label="상태" value={filters.status} empty="진행 중 (완료 제외)"
          options={[["all", "전체"], ...ISSUE_STATUSES.map((s) => [s, ISSUE_STATUS_LABEL[s]] as [string, string])]} />
        <Sel name="customer" label="고객사" value={filters.customer} options={(customers ?? []).map((c) => [c.id, c.name])} />
        <Sel name="assignee" label="담당" value={filters.assignee}
          options={[["none", "미배정"], ...engineers.map((e) => [e.id, e.name] as [string, string])]} />
        <Sel name="severity" label="심각도" value={filters.severity} options={SEVERITIES.map((s) => [s, s])} />
        <button type="submit" className="btn-primary">검색</button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {rows.length}건
          {lateCount > 0 && <span className="ml-2 font-medium text-red-700">기준 초과 {lateCount}건</span>}
        </p>
        <div className="flex gap-2">
          {me && (
            <Link href={href({ assignee: filters.assignee === me.id ? undefined : me.id })}
              className={clsx("btn-secondary", filters.assignee === me.id && "bg-slate-100")}>
              내 이슈
            </Link>
          )}
          <Link href={href({ view: undefined })} className={clsx("btn-secondary", view === "list" && "bg-slate-100")}>목록</Link>
          <Link href={href({ view: "board" })} className={clsx("btn-secondary", view === "board" && "bg-slate-100")}>보드</Link>
        </div>
      </div>

      {view === "board" ? <Board rows={rows} now={now} /> : <List rows={rows} now={now} />}
    </div>
  );
}

function List({ rows, now }: { rows: IssueRow[]; now: number }) {
  if (rows.length === 0) return <p className="card p-8 text-center text-sm text-slate-500">조건에 맞는 이슈가 없습니다.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2.5 font-medium">번호</th>
            <th className="px-3 py-2.5 font-medium">제목 · 고객사</th>
            <th className="px-3 py-2.5 font-medium">심각도</th>
            <th className="px-3 py-2.5 font-medium">상태</th>
            <th className="px-3 py-2.5 font-medium">담당</th>
            <th className="px-3 py-2.5 font-medium">접수 · 경과</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className={clsx(overdue(r, now) && "bg-red-50/40")}>
              <td className="px-3 py-2.5 text-slate-500">#{r.number}</td>
              <td className="px-3 py-2.5">
                <Link href={`/issues/${r.id}`} className="font-medium text-blue-800 hover:underline">{r.title}</Link>
                <p className="text-xs text-slate-500">{r.customer.name}{r.channel && ` · ${r.channel}`}</p>
              </td>
              <td className="px-3 py-2.5"><SeverityBadge severity={r.severity} /></td>
              <td className="px-3 py-2.5"><IssueStatusBadge status={r.status} /></td>
              <td className="px-3 py-2.5">{r.assignee?.name ?? <span className="text-red-700">미배정</span>}</td>
              <td className="px-3 py-2.5">
                <p className="text-xs">{formatDateTime(r.received_at)}</p>
                <Elapsed issue={r} now={now} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Board({ rows, now }: { rows: IssueRow[]; now: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {ISSUE_STATUSES.map((s) => {
        const col = rows.filter((r) => r.status === s);
        return (
          <section key={s} className="rounded-xl bg-slate-100/70 p-2">
            <h2 className="px-1 py-1.5 text-sm font-semibold text-slate-700">
              {ISSUE_STATUS_LABEL[s]} <span className="text-slate-400">{col.length}</span>
            </h2>
            <ul className="space-y-2">
              {col.slice(0, s === "resolved" ? 20 : 100).map((r) => (
                <li key={r.id}>
                  <Link href={`/issues/${r.id}`}
                    className={clsx("card block p-3 hover:border-blue-300", overdue(r, now) && "border-red-300")}>
                    <div className="flex items-center gap-1.5">
                      <SeverityBadge severity={r.severity} />
                      <span className="text-xs text-slate-400">#{r.number}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.customer.name} · {r.assignee?.name ?? "미배정"}</p>
                    <Elapsed issue={r} now={now} />
                  </Link>
                </li>
              ))}
              {s === "resolved" && col.length > 20 && <li className="px-1 text-xs text-slate-500">최근 20건만 표시</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Sel({ name, label, value, options, empty = "전체" }: {
  name: string; label: string; value?: string; options: [string, string][]; empty?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input w-40">
        <option value="">{empty}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
