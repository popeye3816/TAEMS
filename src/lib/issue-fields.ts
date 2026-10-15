// 이슈 상태·심각도·지연 기준 (클라이언트에서도 사용)

export const ISSUE_STATUSES = ["received", "assigned", "in_progress", "resolved"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  received: "접수",
  assigned: "배정",
  in_progress: "처리중",
  resolved: "완료",
};
export const ISSUE_STATUS_STYLE: Record<IssueStatus, string> = {
  received: "bg-slate-100 text-slate-700",
  assigned: "bg-blue-50 text-blue-800",
  in_progress: "bg-amber-50 text-amber-800",
  resolved: "bg-emerald-50 text-emerald-800",
};

export const SEVERITIES = ["긴급", "높음", "보통", "낮음"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_STYLE: Record<Severity, string> = {
  긴급: "bg-red-600 text-white",
  높음: "bg-red-50 text-red-700",
  보통: "bg-slate-100 text-slate-700",
  낮음: "bg-slate-50 text-slate-500",
};

export const CHANNELS = ["전화", "메일", "메신저", "방문", "점검 중 발견", "기타"] as const;

// 지연 기준 (PRD Q7 확정 전 기본값). 바꾸려면 이 숫자만 고치면 된다.
export const UNASSIGNED_LIMIT_HOURS = 4;
export const RESOLVE_LIMIT_DAYS: Record<Severity, number> = { 긴급: 1, 높음: 3, 보통: 7, 낮음: 14 };

type Timed = { status: string; severity: string; received_at: string; resolved_at?: string | null };

// 접수부터 지금(완료면 완료 시각)까지 걸린 시간
export function elapsedMs(i: Timed, now = Date.now()) {
  const end = i.status === "resolved" && i.resolved_at ? Date.parse(i.resolved_at) : now;
  return end - Date.parse(i.received_at);
}

export function formatElapsed(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}분`;
  if (h < 48) return `${h}시간`;
  return `${Math.floor(h / 24)}일`;
}

// 지연 여부와 사유. 완료된 이슈는 지연으로 보지 않는다.
export function overdue(i: Timed, now = Date.now()): string | null {
  if (i.status === "resolved") return null;
  const ms = elapsedMs(i, now);
  if (i.status === "received" && ms > UNASSIGNED_LIMIT_HOURS * 3_600_000) return `미배정 ${UNASSIGNED_LIMIT_HOURS}시간 초과`;
  const days = RESOLVE_LIMIT_DAYS[i.severity as Severity] ?? 7;
  if (ms > days * 86_400_000) return `처리 기준 ${days}일 초과`;
  return null;
}
