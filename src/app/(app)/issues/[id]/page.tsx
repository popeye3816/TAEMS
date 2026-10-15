import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Download, FileText, Image as ImageIcon } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { listStaff } from "@/lib/customers";
import { getIssue, listCustomerIssues, listCustomerOptions } from "@/lib/issues";
import { formatDateTime, requestTime } from "@/lib/format";
import { isImageFile } from "@/lib/inspection-fields";
import { ContentSkeleton } from "@/components/page-header";
import { ActionForm, ConfirmSubmit, Field } from "@/components/action-form";
import { IssueFileUpload } from "@/components/file-upload";
import { formatSize } from "@/components/report-files";
import { Elapsed, IssueStatusBadge, SeverityBadge } from "@/components/issue-badges";
import { IssueForm } from "../issue-form";
import {
  addComment,
  assignIssue,
  deleteComment,
  deleteIssueFile,
  reopenIssue,
  resolveIssue,
  startIssue,
} from "../actions";

type Props = PageProps<"/issues/[id]">;

export default function IssuePage({ params }: Props) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <IssueView params={params} />
    </Suspense>
  );
}

async function IssueView({ params }: Pick<Props, "params">) {
  const user = await requireRole(pathRoles("/issues"));
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();

  const [engineers, related, customers] = await Promise.all([
    listStaff("engineer"),
    listCustomerIssues(issue.customer_id, issue.id, 10),
    listCustomerOptions(),
  ]);
  const me = engineers.find((e) => e.profile_id === user.id);
  const isAdmin = user.role === "admin";
  const isAssignee = Boolean(me) && issue.assignee?.id === me?.id;
  const canChange = isAdmin || isAssignee;
  const resolved = issue.status === "resolved";
  const now = requestTime();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/issues" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> 이슈 목록
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-slate-400">#{issue.number}</span>
          <h1 className="text-xl font-bold text-slate-900">{issue.title}</h1>
          <SeverityBadge severity={issue.severity} />
          <IssueStatusBadge status={issue.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
          <Link href={`/customers/${issue.customer.id}`} className="text-blue-800 hover:underline">
            {issue.customer.name}
          </Link>
          {issue.system && <span>· {[issue.system.product, issue.system.business_name, issue.system.hostname].filter(Boolean).join(" ")}</span>}
          {issue.channel && <span>· {issue.channel}</span>}
          {issue.requester && <span>· 요청자 {issue.requester}</span>}
          {issue.inspection && (
            <Link href={`/schedule/${issue.inspection.id}`} className="hover:underline">
              · {issue.inspection.month}월 점검에서 발견
            </Link>
          )}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          <section className="card p-5">
            <h2 className="text-xs font-semibold text-slate-500">내용</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{issue.description || "—"}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-blue-700">내용 수정</summary>
              <div className="mt-3">
                <IssueForm customers={customers} engineers={engineers} isAdmin={isAdmin} canSelfAssign={false} issue={issue} />
              </div>
            </details>
          </section>

          {resolved ? (
            <section className="card border-emerald-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-emerald-800">처리 결과</h2>
                {canChange && (
                  <form action={reopenIssue}>
                    <input type="hidden" name="id" value={issue.id} />
                    <button type="submit" className="text-xs text-slate-600 hover:underline">
                      완료 취소 (다시 처리)
                    </button>
                  </form>
                )}
              </div>
              <dl className="mt-3 grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-slate-500">원인</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{issue.cause}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">조치</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{issue.action}</dd>
                </div>
              </dl>
              {issue.add_to_kb && <p className="mt-3 text-xs text-blue-700">지식베이스 등록 요청됨 (M5에서 KB 초안으로 만들어집니다)</p>}
            </section>
          ) : (
            canChange &&
            issue.assignee && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-slate-900">완료 처리</h2>
                <p className="mt-0.5 text-xs text-slate-500">원인과 조치는 꼭 남겨 주세요. 같은 문제가 다시 생기면 이 기록을 찾아 씁니다.</p>
                <div className="mt-3">
                  <ActionForm action={resolveIssue} submitLabel="완료">
                    <input type="hidden" name="id" value={issue.id} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="원인 *">
                        <textarea name="cause" rows={4} required defaultValue={issue.cause ?? ""} className="input" />
                      </Field>
                      <Field label="조치 *">
                        <textarea name="action" rows={4} required defaultValue={issue.action ?? ""} className="input" />
                      </Field>
                    </div>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="add_to_kb" defaultChecked /> 지식베이스에 등록 (다른 엔지니어도 찾아볼 수 있게)
                    </label>
                  </ActionForm>
                </div>
              </section>
            )
          )}

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">첨부 파일</h2>
            {issue.files.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                {issue.files.map((f) => {
                  const Icon = isImageFile(f.file_name, f.content_type) ? ImageIcon : FileText;
                  return (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
                        <a href={`/api/files/issue/${f.id}`} className="truncate text-blue-800 hover:underline">{f.file_name}</a>
                        <span className="text-xs text-slate-500">
                          {[formatSize(f.file_size), f.uploader?.name, formatDateTime(f.created_at)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <a href={`/api/files/issue/${f.id}`} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                          <Download className="size-3.5" aria-hidden /> 내려받기
                        </a>
                        {(isAdmin || f.uploaded_by === user.id) && (
                          <ConfirmSubmit action={deleteIssueFile} id={f.id} message={`${f.file_name}을(를) 삭제할까요?`} />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3">
              <IssueFileUpload issueId={issue.id} />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">처리 기록</h2>
            <ol className="mt-3 space-y-3">
              {issue.activities.map((a) => (
                <li key={a.id} className={clsx("text-sm", a.kind !== "comment" && "text-slate-500")}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{a.author?.name ?? "알 수 없음"}</span>
                    <span>{formatDateTime(a.created_at)}</span>
                    {a.kind === "comment" && (a.author?.id === user.id || isAdmin) && (
                      <ConfirmSubmit action={deleteComment} id={a.id} message="이 기록을 삭제할까요?" />
                    )}
                  </div>
                  <p className={clsx("mt-0.5 whitespace-pre-wrap", a.kind === "comment" ? "rounded-lg bg-slate-50 p-3 text-slate-900" : "text-xs")}>
                    {a.body}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ActionForm action={addComment} submitLabel="기록 남기기" resetOnSuccess>
                <input type="hidden" name="id" value={issue.id} />
                <textarea
                  name="body"
                  rows={3}
                  required
                  aria-label="처리 기록"
                  placeholder="확인한 내용, 고객과 통화 내용, 시도한 조치 등을 남겨 주세요."
                  className="input"
                />
              </ActionForm>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card space-y-3 p-4 text-sm">
            <h2 className="text-sm font-semibold text-slate-900">진행</h2>
            <dl className="space-y-1.5">
              <Row label="담당">{issue.assignee?.name ?? <span className="text-red-700">미배정</span>}</Row>
              <Row label="접수">{formatDateTime(issue.received_at)}</Row>
              {issue.assigned_at && <Row label="배정">{formatDateTime(issue.assigned_at)}</Row>}
              {issue.started_at && <Row label="처리 시작">{formatDateTime(issue.started_at)}</Row>}
              {issue.resolved_at && <Row label="완료">{formatDateTime(issue.resolved_at)}</Row>}
              <Row label="경과"><Elapsed issue={issue} now={now} /></Row>
              {issue.reporter && <Row label="등록">{issue.reporter.name}</Row>}
            </dl>

            {!resolved && issue.status === "assigned" && canChange && (
              <form action={startIssue}>
                <input type="hidden" name="id" value={issue.id} />
                <button type="submit" className="btn-primary w-full">처리 시작</button>
              </form>
            )}

            {!resolved && isAdmin && (
              <ActionForm action={assignIssue} submitLabel={issue.assignee ? "담당 변경" : "배정"}>
                <input type="hidden" name="id" value={issue.id} />
                <select name="assignee_id" required defaultValue={issue.assignee?.id ?? ""} aria-label="담당 엔지니어" className="input">
                  <option value="" disabled>엔지니어 선택</option>
                  {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </ActionForm>
            )}
            {!resolved && !isAdmin && !issue.assignee && me && (
              <ActionForm action={assignIssue} submitLabel="내가 맡기">
                <input type="hidden" name="id" value={issue.id} />
                <input type="hidden" name="assignee_id" value="me" />
              </ActionForm>
            )}
            {!resolved && !canChange && issue.assignee && (
              <p className="text-xs text-slate-500">상태 변경은 담당자({issue.assignee.name})와 관리자가 합니다.</p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold text-slate-900">이 고객사의 다른 이슈</h2>
            {related.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-2.5 text-sm">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/issues/${r.id}`} className="font-medium text-blue-800 hover:underline">
                      #{r.number} {r.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <IssueStatusBadge status={r.status} />
                      <span className="text-xs text-slate-500">{formatDateTime(r.received_at).slice(0, 10)}</span>
                    </div>
                    {r.cause && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">원인: {r.cause}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
