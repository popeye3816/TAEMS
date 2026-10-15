"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { ok?: string; error?: string } | undefined;

const requireAdmin = () => requireRole(["admin"]);

export async function addChecklistItem(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const template_id = String(fd.get("template_id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  if (!template_id || !name) return { error: "항목 이름을 입력하세요." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("checklist_items")
    .select("sort_order")
    .eq("template_id", template_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await supabase.from("checklist_items").insert({
    template_id,
    name,
    section: String(fd.get("section") ?? "").trim() || null,
    method: String(fd.get("method") ?? "").trim() || null,
    sort_order: (last?.[0]?.sort_order ?? 0) + 10,
  });
  if (error) return { error: `추가 실패: ${error.message}` };
  refresh();
  return { ok: "항목을 추가했습니다." };
}

// 항목을 지우면 과거 점검 결과도 사라지므로 삭제 대신 사용 중지한다.
export async function toggleChecklistItem(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("checklist_items")
    .update({ is_active: fd.get("active") === "true" })
    .eq("id", String(fd.get("id")));
  refresh();
}
