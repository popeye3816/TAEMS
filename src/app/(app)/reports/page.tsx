import { Suspense } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { listReportTemplates } from "@/lib/inspections";
import { STATUS_LABEL, STATUS_STYLE, parseYm, shiftMonth, ym, type InspectionStatus } from "@/lib/inspection-fields";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { ActionForm, ConfirmSubmit, Field } from "@/components/action-form";
import { TemplateUpload } from "@/components/file-upload";
import { deactivateTemplate } from "../schedule/actions";
import { addChecklistItem, toggleChecklistItem } from "./actions";

type Props = PageProps<"/reports">;

export default function ReportsPage({ searchParams }: Props) {
  return (
    <>
      <PageHeader title="점검결과서" description="월별 점검결과서를 내려받고, 결과서 양식과 표준 점검 항목을 관리합니다." />
      <Suspense fallback={<ContentSkeleton />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Reports({ searchParams }: Pick<Props, "searchParams">) {
  const user = await requireRole(pathRoles("/reports"));
  const sp = await searchParams;
  const isStaff = user.role !== "sales";
  const tabs = [
    { key: "list", label: "월별 결과서" },
    ...(isStaff ? [{ key: "templates", label: "결과서 양식" }] : []),
    ...(user.role === "admin" ? [{ key: "checklists", label: "표준 점검 항목" }] : []),
  ];
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "list";

  return (
    <div className="space-y-5">
      {tabs.length > 1 && (
        <nav className="flex gap-1 border-b border-slate-200">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "list" ? "/reports" : `/reports?tab=${t.key}`}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.key ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {tab === "list" && <MonthlyReports ymParam={typeof sp.ym === "string" ? sp.ym : undefined} isSales={!isStaff} />}
      {tab === "templates" && <Templates isAdmin={user.role === "admin"} />}
      {tab === "checklists" && <Checklists />}
    </div>
  );
}

async function MonthlyReports({ ymParam, isSales }: { ymParam?: string; isSales: boolean }) {
  const { year, month } = parseYm(ymParam);
  const supabase = await createClient();
  // 영업은 RLS로 담당 고객사의 점검만 조회된다.
  const { data, error } = await supabase
    .from("inspections")
    .select(
      `id, status, scheduled_date, completed_at, reported_at,
       customer:customers(id, name, sales_rep:staff!customers_sales_rep_id_fkey(name)),
       engineer:staff(name),
       reports:inspection_reports(id, file_name, product, version, customer_signed, created_at)`,
    )
    .eq("year", year)
    .eq("month", month)
    .neq("status", "canceled");
  if (error) throw new Error(error.message);
  const rows = data.sort((a, b) => a.customer.name.localeCompare(b.customer.name, "ko"));
  const ready = rows.filter((r) => r.reports.length > 0).length;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/reports?ym=${ym(prev.year, prev.month)}`} className="btn-secondary px-2" aria-label="이전 달">
            <ChevronLeft className="size-4" />
          </Link>
          <h2 className="min-w-28 text-center text-lg font-bold">
            {year}년 {month}월
          </h2>
          <Link href={`/reports?ym=${ym(next.year, next.month)}`} className="btn-secondary px-2" aria-label="다음 달">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          결과서 제출 <strong>{ready}</strong> / 점검 {rows.length}건
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">
          {isSales ? "이 달에 담당 고객사의 점검이 없습니다." : "이 달에 등록된 점검이 없습니다."}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">고객사</th>
                <th className="px-3 py-2.5 font-medium">점검일 · 담당</th>
                <th className="px-3 py-2.5 font-medium">상태</th>
                <th className="px-3 py-2.5 font-medium">결과서</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {rows.map((r) => {
                const latest = r.reports.sort((a, b) => b.created_at.localeCompare(a.created_at));
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2.5">
                      {isSales ? (
                        <span className="font-medium">{r.customer.name}</span>
                      ) : (
                        <Link href={`/schedule/${r.id}`} className="font-medium text-blue-800 hover:underline">
                          {r.customer.name}
                        </Link>
                      )}
                      {r.customer.sales_rep && <p className="text-xs text-slate-500">영업 {r.customer.sales_rep.name}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.scheduled_date ?? "날짜 미정"}
                      <p className="text-xs text-slate-500">{r.engineer?.name ?? "미배정"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={clsx("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_STYLE[r.status as InspectionStatus])}>
                        {STATUS_LABEL[r.status as InspectionStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {latest.length === 0 ? (
                        <span className="text-slate-400">미제출</span>
                      ) : (
                        <ul className="space-y-1">
                          {latest.map((f) => (
                            <li key={f.id} className="flex flex-wrap items-center gap-1.5">
                              <FileText className="size-3.5 text-slate-400" aria-hidden />
                              <a href={`/api/files/report/${f.id}`} className="text-blue-800 hover:underline">
                                {f.file_name}
                              </a>
                              <span className="text-xs text-slate-500">
                                v{f.version}
                                {f.product && ` · ${f.product}`}
                              </span>
                              {f.customer_signed && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">서명본</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function Templates({ isAdmin }: { isAdmin: boolean }) {
  const supabase = await createClient();
  const [templates, { data: customers }] = await Promise.all([
    listReportTemplates(),
    isAdmin ? supabase.from("customers").select("id, name").eq("status", "active").order("name") : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-4">
      {isAdmin && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">양식 올리기</h2>
          <TemplateUpload customers={customers ?? []} />
        </section>
      )}
      {templates.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">
          등록된 결과서 양식이 없습니다. {isAdmin ? "회사 표준 양식(.docx 등)을 올려 주세요." : "관리자에게 요청하세요."}
        </p>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">
                  {t.name} <span className="text-xs text-slate-500">v{t.version}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {t.product ?? "공통"} · {t.customer ? `${t.customer.name} 전용` : "회사 표준"} · {t.file_name}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <a href={`/api/files/template/${t.id}`} className="btn-secondary py-1">
                  <Download className="size-4" aria-hidden /> 내려받기
                </a>
                {isAdmin && (
                  <ConfirmSubmit action={deactivateTemplate} id={t.id} label="내리기" message={`${t.name} 양식을 목록에서 내릴까요?`} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Checklists() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checklist_templates")
    .select("id, product, title, result_scale, items:checklist_items(id, section, name, method, sort_order, is_active)")
    .order("product");

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        점검 기록 화면의 항목입니다. 사용 중지한 항목은 새 점검에 나오지 않고, 지난 점검 결과는 그대로 남습니다.
      </p>
      {(data ?? []).map((t) => (
        <section key={t.id} className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            {t.title} <span className="font-normal text-slate-500">({t.product})</span>
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {t.items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((i) => (
                <li key={i.id} className={clsx("flex items-center justify-between gap-3 py-2", !i.is_active && "text-slate-400")}>
                  <span>
                    {i.section && <span className="mr-2 text-xs text-slate-500">{i.section}</span>}
                    {i.name}
                    {i.method && <span className="ml-2 text-xs text-slate-500">— {i.method}</span>}
                  </span>
                  <form action={toggleChecklistItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="active" value={String(!i.is_active)} />
                    <button type="submit" className="text-xs text-blue-700 hover:underline">
                      {i.is_active ? "사용 중지" : "다시 사용"}
                    </button>
                  </form>
                </li>
              ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ActionForm action={addChecklistItem} submitLabel="항목 추가" resetOnSuccess>
              <input type="hidden" name="template_id" value={t.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="구분 (선택)">
                  <input name="section" className="input" />
                </Field>
                <Field label="항목 이름 *">
                  <input name="name" required className="input" />
                </Field>
                <Field label="점검 방법">
                  <input name="method" className="input" />
                </Field>
              </div>
            </ActionForm>
          </div>
        </section>
      ))}
    </div>
  );
}
