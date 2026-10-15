import { Suspense } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Eye, Plus, ThumbsUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { countDrafts, searchKb } from "@/lib/kb";
import { KB_CATEGORIES, KB_KIND_LABEL, type KbKind } from "@/lib/kb-fields";
import { formatDateTime } from "@/lib/format";
import { ContentSkeleton, PageHeader } from "@/components/page-header";

type Props = PageProps<"/kb">;

export default function KbPage({ searchParams }: Props) {
  return (
    <>
      <PageHeader
        title="지식베이스"
        description="문제 해결 사례와 작업 가이드를 검색합니다. 완료한 이슈의 원인·조치도 여기에 쌓입니다."
        actions={
          <Link href="/kb/new" className="btn-primary">
            <Plus className="size-4" aria-hidden /> 문서 작성
          </Link>
        }
      />
      <Suspense fallback={<ContentSkeleton />}>
        <KbList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const p = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

async function KbList({ searchParams }: Pick<Props, "searchParams">) {
  await requireRole(pathRoles("/kb"));
  const sp = await searchParams;
  const filters = { q: p(sp.q), category: p(sp.category), kind: p(sp.kind), status: p(sp.status) };
  const [rows, drafts] = await Promise.all([searchKb(filters), countDrafts()]);

  return (
    <div className="space-y-4">
      <form className="card space-y-3 p-4" role="search">
        <div className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="증상, 오류 메시지, 제품, 태그로 검색 (예: OOM, heapdump, 라이선스)"
            aria-label="검색어"
            className="input min-w-64 flex-1"
          />
          <button type="submit" className="btn-primary">검색</button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Sel name="category" label="분류" value={filters.category} options={KB_CATEGORIES.map((c) => [c, c])} />
          <Sel name="kind" label="종류" value={filters.kind} options={Object.entries(KB_KIND_LABEL)} />
          <Sel name="status" label="상태" value={filters.status} options={[["published", "게시"], ["draft", "초안"]]} />
        </div>
      </form>

      {drafts > 0 && filters.status !== "draft" && (
        <Link href="/kb?status=draft" className="card block border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900 hover:bg-amber-50">
          검토를 기다리는 초안이 <strong>{drafts}건</strong> 있습니다. 내용을 다듬어 게시해 주세요. →
        </Link>
      )}

      <p className="text-sm text-slate-500">
        {filters.q ? `"${filters.q}" 검색 결과 ${rows.length}건` : `최근 문서 ${rows.length}건`}
      </p>

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">
          {filters.q ? "찾는 문서가 없습니다. 다른 단어로 검색하거나 새 문서를 작성해 주세요." : "아직 문서가 없습니다."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            const preview = a.kind === "case" ? a.symptom || a.cause : a.content?.replace(/[#>*`|_-]+/g, " ");
            return (
              <li key={a.id}>
                <Link href={`/kb/${a.id}`} className="card block p-4 hover:border-blue-300">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{a.category}</span>
                    <span className="text-slate-500">{KB_KIND_LABEL[a.kind as KbKind]}</span>
                    {a.status === "draft" && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">초안</span>}
                    <span className="text-slate-400">#{a.number}</span>
                  </div>
                  <p className="mt-1 font-medium text-blue-900">{a.title}</p>
                  {preview && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{preview}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {a.product && <span>{a.product}</span>}
                    {a.customer && <span>{a.customer.name}</span>}
                    {a.tags.slice(0, 5).map((t) => <span key={t} className="text-blue-700">#{t}</span>)}
                    <span className="inline-flex items-center gap-0.5"><Eye className="size-3" aria-hidden />{a.view_count}</span>
                    {a.helpful_count > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-700"><ThumbsUp className="size-3" aria-hidden />{a.helpful_count}</span>
                    )}
                    <span>{formatDateTime(a.updated_at).slice(0, 10)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Sel({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-slate-600">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={clsx("input w-auto py-1")}>
        <option value="">전체</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
