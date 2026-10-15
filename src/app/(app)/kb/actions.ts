"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { suggestKb, type KbSuggestion } from "@/lib/kb";
import { KB_CATEGORIES, parseTags } from "@/lib/kb-fields";

export type FormState = { ok?: string; error?: string } | undefined;

const requireStaff = () => requireRole(pathRoles("/kb"));

function text(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

export async function saveKb(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = text(fd, "id");
  const title = text(fd, "title");
  const kind = text(fd, "kind") === "guide" ? "guide" : "case";
  if (!title) return { error: "제목을 입력하세요." };
  const row = {
    kind,
    title,
    status: text(fd, "status") === "published" ? "published" : "draft",
    category: (KB_CATEGORIES as readonly string[]).includes(text(fd, "category") ?? "") ? text(fd, "category")! : "기타",
    product: text(fd, "product"),
    environment: text(fd, "environment"),
    tags: parseTags(text(fd, "tags")),
    symptom: kind === "case" ? text(fd, "symptom") : null,
    cause: kind === "case" ? text(fd, "cause") : null,
    solution: kind === "case" ? text(fd, "solution") : null,
    content: text(fd, "content"), // 가이드 본문, 사례는 추가 설명
    updated_by: user.id,
  };
  if (row.status === "published") {
    if (kind === "case" && (!row.symptom || !row.solution)) return { error: "게시하려면 증상과 해결 방법을 입력하세요." };
    if (kind === "guide" && !row.content) return { error: "게시하려면 본문을 입력하세요." };
  }
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("kb_articles").update(row).eq("id", id);
    if (error) return { error: `저장 실패: ${error.message}` };
    redirect(`/kb/${id}`);
  }
  const { data, error } = await supabase
    .from("kb_articles")
    .insert({ ...row, author_id: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: `등록 실패: ${error?.message}` };
  redirect(`/kb/${data.id}`);
}

export async function setKbStatus(fd: FormData) {
  const user = await requireStaff();
  const status = fd.get("status") === "published" ? "published" : "draft";
  const supabase = await createClient();
  await supabase.from("kb_articles").update({ status, updated_by: user.id }).eq("id", String(fd.get("id")));
  refresh();
}

export async function deleteKb(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("kb_articles").delete().eq("id", String(fd.get("id")));
  if (!error) redirect("/kb");
}

export async function toggleHelpful(fd: FormData) {
  const user = await requireStaff();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  if (fd.get("on") === "true") {
    await supabase.from("kb_helpful").upsert({ article_id: id, user_id: user.id }, { ignoreDuplicates: true });
  } else {
    await supabase.from("kb_helpful").delete().match({ article_id: id, user_id: user.id });
  }
  refresh();
}

export async function recordKbView(id: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.rpc("kb_record_view", { p_id: id });
}

// 이슈 등록 화면에서 입력 중인 제목·내용으로 비슷한 문서를 찾는다
export async function findSimilarKb(text: string): Promise<KbSuggestion[]> {
  await requireStaff();
  return suggestKb(text, 5);
}
