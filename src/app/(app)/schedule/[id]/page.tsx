import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Download } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { getInspection, listReportTemplates } from "@/lib/inspections";
import { STATUS_LABEL, STATUS_STYLE, type InspectionStatus } from "@/lib/inspection-fields";
import { describePlan } from "@/lib/inspection-cycle";
import { ContentSkeleton } from "@/components/page-header";
import { ReportUpload } from "@/components/file-upload";
import { ReportFileList } from "@/components/report-files";

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
  const templates = (await listReportTemplates(insp.customer.id))
    .filter((t) => !t.product || insp.products.includes(t.product))
    .sort((a, b) => Number(Boolean(b.customer_id)) - Number(Boolean(a.customer_id)));
  const status = insp.status as InspectionStatus;

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
        {insp.summary && <p className="mt-1 text-sm text-slate-700">{insp.summary}</p>}
        <Link
          href={`/issues/new?customer=${insp.customer.id}&inspection=${insp.id}`}
          className="btn-secondary mt-3"
        >
          점검 중 발견한 문제를 이슈로 등록
        </Link>
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

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">점검결과서 · 사진</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            완성한 결과서(PDF·Word·한글)나 현장 사진을 올리면 상태가 <strong>결과서제출</strong>로 바뀌고, 영업 담당자가
            점검결과서 화면에서 내려받아 대가 청구에 씁니다.
          </p>
        </div>

        <ReportUpload inspectionId={insp.id} />

        <ReportFileList reports={insp.reports} canDelete={user.role === "admin"} canEdit />

        {templates.length > 0 && (
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">결과서 양식 내려받기</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <a href={`/api/files/template/${t.id}`} className="btn-secondary py-1 text-xs">
                    <Download className="size-3.5" aria-hidden />
                    {t.name} v{t.version}
                    {t.customer_id && <span className="text-blue-700">(전용)</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
