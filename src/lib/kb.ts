import "server-only";
import { createClient } from "@/lib/supabase/server";

const LIST_SELECT = `id, number, kind, status, title, category, product, tags, symptom, cause, content,
  view_count, updated_at, customer:customers(name), helpful:kb_helpful(count)`;

export type KbFilters = { q?: string; category?: string; kind?: string; status?: string };

// 검색어가 있으면 search_kb 함수의 순위대로, 없으면 최근 수정 순
export async function searchKb(f: KbFilters, limit = 60) {
  const supabase = await createClient();
  let ids: string[] | null = null;
  if (f.q) {
    const { data, error } = await supabase.rpc("search_kb", { q: f.q, lim: 200 });
    if (error) throw new Error(`검색 실패: ${error.message}`);
    ids = data.map((r) => r.id);
    if (ids.length === 0) return [];
  }
  let query = supabase.from("kb_articles").select(LIST_SELECT);
  if (ids) query = query.in("id", ids);
  else query = query.order("updated_at", { ascending: false }).limit(limit);
  if (f.category) query = query.eq("category", f.category);
  if (f.kind) query = query.eq("kind", f.kind);
  if (f.status) query = query.eq("status", f.status);
  const { data, error } = await query;
  if (error) throw new Error(`지식베이스 조회 실패: ${error.message}`);
  const rows = data.map((a) => ({ ...a, helpful_count: a.helpful[0]?.count ?? 0 }));
  return ids ? rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)).slice(0, limit) : rows;
}
export type KbRow = Awaited<ReturnType<typeof searchKb>>[number];

export async function countDrafts() {
  const supabase = await createClient();
  const { count } = await supabase.from("kb_articles").select("id", { count: "exact", head: true }).eq("status", "draft");
  return count ?? 0;
}

export async function getKb(id: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_articles")
    .select(
      `*, customer:customers(id, name), issue:issues(id, number, title),
       author:profiles!kb_articles_author_id_fkey(id, name), editor:profiles!kb_articles_updated_by_fkey(name),
       helpful:kb_helpful(user_id)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`지식베이스 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    ...data,
    helpful_count: data.helpful.length,
    helpful_by_me: data.helpful.some((h) => h.user_id === userId),
  };
}
export type KbDetail = NonNullable<Awaited<ReturnType<typeof getKb>>>;

// 이슈 제목·내용과 비슷한 문서 (등록 화면 추천, 이슈 상세 사이드바)
export async function suggestKb(text: string, limit = 5, excludeIssueId?: string) {
  if (text.trim().length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_kb", { q: text.slice(0, 300), lim: limit + 1 });
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data: rows } = await supabase
    .from("kb_articles")
    .select("id, number, title, status, kind, category, cause, source_issue_id")
    .in("id", ids);
  return (rows ?? [])
    .filter((r) => !excludeIssueId || r.source_issue_id !== excludeIssueId)
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    .slice(0, limit);
}
export type KbSuggestion = Awaited<ReturnType<typeof suggestKb>>[number];
