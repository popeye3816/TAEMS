import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Eye, Pencil, ThumbsUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { getKb } from "@/lib/kb";
import { KB_KIND_LABEL, type KbKind } from "@/lib/kb-fields";
import { formatDateTime } from "@/lib/format";
import { ContentSkeleton } from "@/components/page-header";
import { ConfirmSubmit } from "@/components/action-form";
import { Markdown } from "@/components/markdown";
import { deleteKb, setKbStatus, toggleHelpful } from "../actions";
import { ViewRecorder } from "../view-recorder";

type Props = PageProps<"/kb/[id]">;

export default function KbArticlePage({ params }: Props) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: Pick<Props, "params">) {
  const user = await requireRole(pathRoles("/kb"));
  const { id } = await params;
  const a = await getKb(id, user.id);
  if (!a) notFound();
  const draft = a.status === "draft";
  const canDelete = user.role === "admin" || a.author?.id === user.id;

  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <ViewRecorder id={a.id} />
      <div>
        <Link href="/kb" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> 지식베이스
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{a.category}</span>
          <span className="text-slate-500">{KB_KIND_LABEL[a.kind as KbKind]}</span>
          <span className="text-slate-400">#{a.number}</span>
          {draft && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">초안</span>}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{a.title}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-500">
          {a.product && <span>{a.product}</span>}
          {a.environment && <span>{a.environment}</span>}
          {a.customer && (
            <Link href={`/customers/${a.customer.id}`} className="hover:underline">{a.customer.name}</Link>
          )}
          {a.issue && (
            <Link href={`/issues/${a.issue.id}`} className="hover:underline">이슈 #{a.issue.number}에서 작성</Link>
          )}
          {a.source_note && !a.issue && <span>출처: {a.source_note}</span>}
        </p>
        {a.tags.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-2 text-xs">
            {a.tags.map((t) => (
              <Link key={t} href={`/kb?q=${encodeURIComponent(t)}`} className="text-blue-700 hover:underline">#{t}</Link>
            ))}
          </p>
        )}
      </div>

      {draft && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          <span>초안입니다. 고객사 고유 정보(IP·계정)가 없는지 확인하고 내용을 다듬은 뒤 게시해 주세요.</span>
          <form action={setKbStatus}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="status" value="published" />
            <button type="submit" className="btn-primary">게시</button>
          </form>
        </div>
      )}

      {a.kind === "case" ? (
        <div className="space-y-4">
          <Section title="증상" body={a.symptom} />
          <Section title="원인" body={a.cause} />
          <Section title="해결 방법" body={a.solution} highlight />
          {a.content && (
            <section className="card p-5">
              <h2 className="text-xs font-semibold text-slate-500">추가 설명</h2>
              <div className="mt-2"><Markdown>{a.content}</Markdown></div>
            </section>
          )}
        </div>
      ) : (
        <section className="card p-6">
          {a.content ? <Markdown>{a.content}</Markdown> : <p className="text-sm text-slate-500">본문이 없습니다.</p>}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
        <div className="flex flex-wrap items-center gap-3 text-slate-500">
          <form action={toggleHelpful}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="on" value={String(!a.helpful_by_me)} />
            <button
              type="submit"
              className={clsx("btn-secondary", a.helpful_by_me && "border-emerald-300 bg-emerald-50 text-emerald-800")}
            >
              <ThumbsUp className="size-4" aria-hidden /> 도움됨 {a.helpful_count > 0 && a.helpful_count}
            </button>
          </form>
          <span className="inline-flex items-center gap-1"><Eye className="size-4" aria-hidden /> {a.view_count}</span>
          <span>
            작성 {a.author?.name ?? "—"} · {formatDateTime(a.created_at).slice(0, 10)}
            {a.editor && ` · 수정 ${a.editor.name} ${formatDateTime(a.updated_at)}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!draft && (
            <form action={setKbStatus}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value="draft" />
              <button type="submit" className="text-xs text-slate-600 hover:underline">초안으로 내리기</button>
            </form>
          )}
          {canDelete && <ConfirmSubmit action={deleteKb} id={a.id} message="이 문서를 삭제할까요?" />}
          <Link href={`/kb/${a.id}/edit`} className="btn-secondary">
            <Pencil className="size-4" aria-hidden /> 수정
          </Link>
        </div>
      </div>
    </article>
  );
}

function Section({ title, body, highlight }: { title: string; body: string | null; highlight?: boolean }) {
  return (
    <section className={clsx("card p-5", highlight && "border-emerald-200")}>
      <h2 className={clsx("text-xs font-semibold", highlight ? "text-emerald-800" : "text-slate-500")}>{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{body || <span className="text-slate-400">—</span>}</p>
    </section>
  );
}
