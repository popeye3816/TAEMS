import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { getInspection, listChecklists, listReportTemplates, type InspectionDetail } from "@/lib/inspections";
import { RESULT_HINT, RESULT_OPTIONS, STATUS_LABEL, STATUS_STYLE, isBadResult, type InspectionStatus } from "@/lib/inspection-fields";
import { describePlan } from "@/lib/inspection-cycle";
import { ContentSkeleton } from "@/components/page-header";
import { ActionForm, ConfirmSubmit, Field } from "@/components/action-form";
import { ReportUpload } from "@/components/file-upload";
import { deleteReport, saveInspectionRecord, toggleSigned } from "../actions";

type Props = PageProps<"/schedule/[id]">;

export default function InspectionPage({ params }: Props) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <InspectionView params={params} />
    </Suspense>
  );
}

async function InspectionView({ params }: Pick<Props, "params">) {
  const user = await requireRole(pathRoles("/schedule"));
  const { id } = await params;
  const insp = await getInspection(id);
  if (!insp) notFound();
  const [checklists, templates] = await Promise.all([
    listChecklists(insp.products),
    listReportTemplates(insp.customer.id),
  ]);
  const status = insp.status as InspectionStatus;
  const badCount = insp.results.filter((r) => isBadResult(r.result)).length;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/schedule?ym=${insp.year}-${String(insp.month).padStart(2, "0")}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" aria-hidden /> {insp.year}년 {insp.month}월 일정
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">
            <Link href={`/customers/${insp.customer.id}`} className="hover:underline">
              {insp.customer.name}
            </Link>{" "}
            {insp.month}월 점검
          </h1>
          <span className={clsx("rounded px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {[
            insp.scheduled_date ?? "날짜 미정",
            insp.method,
            insp.engineer ? `담당 ${insp.engineer.name}` : "담당 미배정",
            insp.products.join(", "),
            insp.plan && describePlan(insp.plan),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {(insp.customer.visit_procedure || insp.customer.inspection_method) && (
        <section className="card grid gap-4 p-4 text-sm md:grid-cols-2">
          {insp.customer.inspection_method && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500">정기점검 방법</h2>
              <p className="mt-1 whitespace-pre-wrap">{insp.customer.inspection_method}</p>
            </div>
          )}
          {insp.customer.visit_procedure && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500">방문 시 출입 절차</h2>
              <p className="mt-1 whitespace-pre-wrap">{insp.customer.visit_procedure}</p>
            </div>
          )}
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">점검 기록</h2>
        {badCount > 0 && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            비정상·확인 필요 항목이 {badCount}건 있습니다. 이슈 등록 기능(M4)이 생기면 여기서 바로 이슈로 넘길 수 있습니다.
          </p>
        )}
        <div className="mt-4">
          <ActionForm action={saveInspectionRecord}>
            <input type="hidden" name="id" value={insp.id} />
            {checklists.length === 0 && (
              <p className="text-sm text-slate-500">이 점검의 제품({insp.products.join(", ") || "없음"})에 해당하는 표준 점검 항목이 없습니다.</p>
            )}
            {checklists.map((t) => (
              <ChecklistGrid key={t.id} template={t} insp={insp} />
            ))}
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="점검 요약">
                <textarea name="summary" rows={3} defaultValue={insp.summary ?? ""} className="input" />
              </Field>
              <Field label="발견사항 · 특이사항">
                <textarea name="findings" rows={3} defaultValue={insp.findings ?? ""} className="input" />
              </Field>
              <Field label="후속 조치">
                <textarea name="follow_up" rows={3} defaultValue={insp.follow_up ?? ""} className="input" />
              </Field>
            </div>
            {["planned", "scheduled"].includes(status) && (
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="complete" /> 점검을 마쳤습니다 (상태를 <strong>점검완료</strong>로 변경)
              </label>
            )}
          </ActionForm>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">점검결과서</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            결과서를 올리면 상태가 <strong>결과서제출</strong>로 바뀌고, 영업 담당자가 점검결과서 화면에서 내려받아 대가 청구에 씁니다.
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">양식 내려받기</p>
          {templates.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              등록된 양식이 없습니다.{" "}
              {user.role === "admin" ? (
                <Link href="/reports?tab=templates" className="underline">
                  양식 올리기
                </Link>
              ) : (
                "관리자에게 양식 등록을 요청하세요."
              )}
            </p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-2">
              {templates
                .filter((t) => !t.product || insp.products.includes(t.product))
                .sort((a, b) => Number(Boolean(b.customer_id)) - Number(Boolean(a.customer_id)))
                .map((t) => (
                  <li key={t.id}>
                    <a href={`/api/files/template/${t.id}`} className="btn-secondary py-1 text-xs">
                      <Download className="size-3.5" aria-hidden />
                      {t.name} v{t.version}
                      {t.customer_id && <span className="text-blue-700">(전용)</span>}
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {insp.reports.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {insp.reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-slate-400" aria-hidden />
                  <a href={`/api/files/report/${r.id}`} className="font-medium text-blue-800 hover:underline">
                    {r.file_name}
                  </a>
                  <span className="text-xs text-slate-500">
                    v{r.version} · {r.product ?? "전체"} · {formatSize(r.file_size)} · {r.uploader?.name} ·{" "}
                    {r.created_at.slice(0, 16).replace("T", " ")}
                  </span>
                  {r.customer_signed && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">서명본</span>}
                </div>
                <div className="flex items-center gap-3">
                  <form action={toggleSigned}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="signed" value={String(!r.customer_signed)} />
                    <button type="submit" className="text-xs text-blue-700 hover:underline">
                      {r.customer_signed ? "서명본 표시 해제" : "서명본으로 표시"}
                    </button>
                  </form>
                  {user.role === "admin" && (
                    <ConfirmSubmit action={deleteReport} id={r.id} message={`${r.file_name}을(를) 삭제할까요? 파일도 함께 지워집니다.`} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <ReportUpload inspectionId={insp.id} products={insp.products} />
      </section>
    </div>
  );
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

type Checklist = Awaited<ReturnType<typeof listChecklists>>[number];

// 표준 점검 항목 × 대상 서버 입력 표. 해당 제품 서버가 없으면 '전체' 한 열로 입력한다.
function ChecklistGrid({ template, insp }: { template: Checklist; insp: InspectionDetail }) {
  const systems = insp.customer.systems.filter((s) => s.product === template.product);
  const targets =
    systems.length > 0
      ? systems.map((s) => ({ key: s.id, label: [s.business_name, s.hostname].filter(Boolean).join(" ") || s.product }))
      : [{ key: "all", label: "전체" }];
  const options = RESULT_OPTIONS[template.result_scale] ?? [];
  const value = (itemId: string, key: string) => insp.results.find((r) => r.item_id === itemId && r.target_key === key);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-800">
        {template.title}
        <span className="ml-2 text-xs font-normal text-slate-500">
          결과: {options.map((o) => (RESULT_HINT[o] ? `${o}(${RESULT_HINT[o]})` : o)).join(" / ")}
        </span>
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm" style={{ minWidth: 320 + targets.length * 200 }}>
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2 font-medium">점검 항목</th>
              {targets.map((t) => (
                <th key={t.key} className="px-3 py-2 font-medium">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {template.items.map((item) => (
              <tr key={item.id}>
                <td className="sticky left-0 bg-white px-3 py-2">
                  <p className="font-medium">{item.name}</p>
                  {item.method && <p className="text-xs text-slate-500">{item.method}</p>}
                </td>
                {targets.map((t) => {
                  const v = value(item.id, t.key);
                  return (
                    <td key={t.key} className="px-3 py-2 align-top">
                      <div className="flex gap-1.5">
                        <select
                          name={`r|${item.id}|${t.key}|${t.label}`}
                          defaultValue={v?.result ?? ""}
                          aria-label={`${item.name} ${t.label} 결과`}
                          className={clsx("input w-20 py-1", isBadResult(v?.result) && "border-amber-400 bg-amber-50")}
                        >
                          <option value="">-</option>
                          {options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                        <input
                          name={`d|${item.id}|${t.key}`}
                          defaultValue={v?.detail ?? ""}
                          placeholder="상세"
                          aria-label={`${item.name} ${t.label} 상세`}
                          className="input py-1"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
