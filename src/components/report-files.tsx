import { Download, FileText, Image as ImageIcon } from "lucide-react";
import { isImageFile } from "@/lib/inspection-fields";
import { formatDateTime } from "@/lib/format";
import { deleteReport, toggleSigned } from "@/app/(app)/schedule/actions";
import { ConfirmSubmit } from "./action-form";

type ReportFile = {
  id: string;
  file_name: string;
  file_size?: number | null;
  content_type?: string | null;
  product?: string | null;
  version?: number;
  customer_signed: boolean;
  created_at: string;
  uploader?: { name: string } | null;
};

export function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

// 결과서·사진 목록. 파일 이름을 누르면 내려받는다.
export function ReportFileList({
  reports,
  canEdit = false,
  canDelete = false,
}: {
  reports: ReportFile[];
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  if (reports.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">올린 파일이 없습니다.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {reports.map((r) => {
        const Icon = isImageFile(r.file_name, r.content_type) ? ImageIcon : FileText;
        return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
              <a href={`/api/files/report/${r.id}`} className="truncate font-medium text-blue-800 hover:underline">
                {r.file_name}
              </a>
              {r.customer_signed && (
                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">서명본</span>
              )}
              <span className="text-xs text-slate-500">
                {[r.product, formatSize(r.file_size), r.uploader?.name, formatDateTime(r.created_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a href={`/api/files/report/${r.id}`} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                <Download className="size-3.5" aria-hidden /> 내려받기
              </a>
              {canEdit && (
                <form action={toggleSigned}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="signed" value={String(!r.customer_signed)} />
                  <button type="submit" className="text-xs text-slate-600 hover:underline">
                    {r.customer_signed ? "서명본 해제" : "서명본 표시"}
                  </button>
                </form>
              )}
              {canDelete && (
                <ConfirmSubmit action={deleteReport} id={r.id} message={`${r.file_name}을(를) 삭제할까요? 파일도 함께 지워집니다.`} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
