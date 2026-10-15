import { Suspense } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { listBusinessUnits, listCustomers, listStaff } from "@/lib/customers";
import { PRODUCTS, STATUS_LABELS } from "@/lib/customer-fields";
import { ContentSkeleton, PageHeader } from "@/components/page-header";

type Search = PageProps<"/customers">["searchParams"];

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <>
      <PageHeader
        title="고객사"
        description="고객사별 시스템·담당자·계약·점검 정보를 한곳에서 봅니다."
        actions={
          <Link href="/customers/new" className="btn-primary">
            <Plus className="size-4" aria-hidden />
            고객사 추가
          </Link>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function param(v: string | string[] | undefined) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function CustomerList({ searchParams }: { searchParams: Search }) {
  await requireRole(pathRoles("/customers"));
  const sp = await searchParams;
  const filters = {
    q: param(sp.q),
    product: param(sp.product),
    engineer: param(sp.engineer),
    team: param(sp.team),
    status: param(sp.status),
  };
  const [rows, engineers, teams] = await Promise.all([
    listCustomers(filters),
    listStaff("engineer"),
    listBusinessUnits(),
  ]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <form className="card flex flex-wrap items-end gap-3 p-4" role="search">
        <label className="min-w-48 flex-1 space-y-1 text-sm">
          <span className="text-slate-600">고객사명</span>
          <input name="q" defaultValue={filters.q} placeholder="이름으로 검색" className="input" />
        </label>
        <Select name="product" label="제품" value={filters.product} options={PRODUCTS.map((p) => [p, p])} />
        <Select
          name="engineer"
          label="담당 엔지니어"
          value={filters.engineer}
          options={engineers.map((e) => [e.id, e.name])}
        />
        <Select name="team" label="영업팀" value={filters.team} options={teams.map((t) => [t, t])} />
        <Select
          name="status"
          label="상태"
          value={filters.status}
          options={[["ended", STATUS_LABELS.ended]]}
          emptyLabel={STATUS_LABELS.active}
        />
        <button type="submit" className="btn-primary">
          검색
        </button>
        {filtered && (
          <Link href="/customers" className="btn-secondary">
            초기화
          </Link>
        )}
      </form>

      <p className="text-sm text-slate-500">{rows.length}곳</p>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">고객사</th>
              <th className="px-4 py-2.5 font-medium">제품</th>
              <th className="px-4 py-2.5 font-medium">영업</th>
              <th className="px-4 py-2.5 font-medium">담당 엔지니어</th>
              <th className="px-4 py-2.5 font-medium">점검시기</th>
              <th className="px-4 py-2.5 font-medium">중요도</th>
              <th className="px-4 py-2.5 font-medium">원격</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  {filtered ? "조건에 맞는 고객사가 없습니다." : "등록된 고객사가 없습니다."}
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="font-medium text-blue-800 hover:underline">
                    {c.name}
                  </Link>
                  {c.business_unit && <p className="text-xs text-slate-500">{c.business_unit}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.products.map((p) => (
                      <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{c.sales_rep?.name}</td>
                <td className="px-4 py-3">
                  {c.primary ? c.primary.name : <span className="text-amber-700">미배정</span>}
                  {c.secondary.length > 0 && (
                    <span className="text-slate-500"> · 부 {c.secondary.map((s) => s.name).join(", ")}</span>
                  )}
                </td>
                <td className="max-w-48 truncate px-4 py-3" title={c.inspection_cycle_note ?? undefined}>
                  {c.inspection_cycle_note}
                </td>
                <td className="px-4 py-3">
                  {c.importance && (
                    <span
                      className={clsx(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        c.importance === "상" && "bg-red-50 text-red-700",
                        c.importance === "중" && "bg-amber-50 text-amber-800",
                        c.importance === "하" && "bg-slate-100 text-slate-600",
                      )}
                    >
                      {c.importance}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{c.remote_access}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
  emptyLabel = "전체",
}: {
  name: string;
  label: string;
  value?: string;
  options: [string, string][];
  emptyLabel?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input w-36">
        <option value="">{emptyLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
