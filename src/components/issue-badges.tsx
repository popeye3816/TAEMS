import clsx from "clsx";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_STYLE,
  SEVERITY_STYLE,
  elapsedMs,
  formatElapsed,
  overdue,
  type IssueStatus,
  type Severity,
} from "@/lib/issue-fields";

export function IssueStatusBadge({ status }: { status: string }) {
  const s = status as IssueStatus;
  return <span className={clsx("rounded px-1.5 py-0.5 text-xs font-medium", ISSUE_STATUS_STYLE[s])}>{ISSUE_STATUS_LABEL[s]}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={clsx("rounded px-1.5 py-0.5 text-xs font-medium", SEVERITY_STYLE[severity as Severity])}>{severity}</span>
  );
}

// 경과시간. 기준을 넘기면 빨간색과 사유를 보여준다.
export function Elapsed({
  issue,
  now,
}: {
  issue: { status: string; severity: string; received_at: string; resolved_at?: string | null };
  now: number;
}) {
  const late = overdue(issue, now);
  const label = formatElapsed(elapsedMs(issue, now));
  return (
    <span className={clsx("text-xs", late ? "font-medium text-red-700" : "text-slate-500")} title={late ?? undefined}>
      {issue.status === "resolved" ? `${label} 걸림` : `${label} 경과`}
      {late && <span className="ml-1">· {late}</span>}
    </span>
  );
}
