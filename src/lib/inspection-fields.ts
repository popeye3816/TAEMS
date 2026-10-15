import { todayKst } from "./format";

// 점검 상태·결과 표시용 (클라이언트에서도 사용)

export const INSPECTION_STATUSES = ["planned", "scheduled", "done", "reported", "canceled"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const STATUS_LABEL: Record<InspectionStatus, string> = {
  planned: "예정",
  scheduled: "일정확정",
  done: "점검완료",
  reported: "결과서제출",
  canceled: "취소",
};

export const STATUS_STYLE: Record<InspectionStatus, string> = {
  planned: "bg-slate-100 text-slate-700",
  scheduled: "bg-blue-50 text-blue-800",
  done: "bg-amber-50 text-amber-800",
  reported: "bg-emerald-50 text-emerald-800",
  canceled: "bg-slate-100 text-slate-400 line-through",
};

// 결과서로 올릴 수 있는 파일: 문서(PDF·Word·한글·Excel·PowerPoint), 사진, 압축
export const REPORT_ACCEPT =
  ".pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.heic,.zip";
export const isImageFile = (name: string, contentType?: string | null) =>
  (contentType ?? "").startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/i.test(name);

export function ym(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// 'YYYY-MM' 해석. 없거나 잘못되면 이번 달(한국 기준)
export function parseYm(v: string | undefined | null) {
  const [ty, tm] = todayKst().split("-").map(Number);
  const m = v?.match(/^(\d{4})-(\d{1,2})$/);
  const year = m ? Number(m[1]) : ty;
  const month = m ? Number(m[2]) : tm;
  return month >= 1 && month <= 12 ? { year, month } : { year: ty, month: tm };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
