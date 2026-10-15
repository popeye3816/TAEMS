"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, type CurrentUser } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CHANNELS, ISSUE_STATUS_LABEL, SEVERITIES, type IssueStatus } from "@/lib/issue-fields";
import type { TablesUpdate } from "@/lib/database.types";
import { kstInputToIso } from "@/lib/format";

export type FormState = { ok?: string; error?: string } | undefined;

const requireStaff = () => requireRole(pathRoles("/issues"));

function text(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}
function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[]): T | null {
  const v = text(fd, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}
function fail(e: { message: string } | null, what: string): FormState {
  if (!e) return undefined;
  if (/row-level security|permission/i.test(e.message)) return { error: `${what}: 권한이 없습니다.` };
  if (/issues_resolve_requires_cause_action/.test(e.message)) return { error: "완료하려면 원인과 조치를 입력하세요." };
  return { error: `${what} 실패: ${e.message}` };
}

async function myStaffId(user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase.from("staff").select("id").eq("profile_id", user.id).maybeSingle();
  return data?.id ?? null;
}

async function log(issueId: string, user: CurrentUser, kind: "comment" | "status" | "assign" | "edit", body: string) {
  const supabase = await createClient();
  await supabase.from("issue_activities").insert({ issue_id: issueId, author_id: user.id, kind, body });
}

// 상태를 바꿀 수 있는 사람: 관리자 또는 현재 담당자
async function loadForChange(id: string, user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("issues")
    .select("id, status, assignee_id, assignee:staff(name, profile_id)")
    .eq("id", id)
    .single();
  if (!data) return { error: "이슈를 찾을 수 없습니다." } as const;
  const isAssignee = data.assignee?.profile_id === user.id;
  return { issue: data, canChange: user.role === "admin" || isAssignee } as const;
}

// ── 등록 ───────────────────────────────────────────────────────────
export async function createIssue(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const customer_id = text(fd, "customer_id");
  const title = text(fd, "title");
  if (!customer_id) return { error: "고객사를 선택하세요." };
  if (!title) return { error: "제목을 입력하세요." };

  let assignee_id = text(fd, "assignee_id");
  if (assignee_id === "me") assignee_id = await myStaffId(user);
  if (assignee_id && user.role !== "admin" && assignee_id !== (await myStaffId(user))) {
    return { error: "다른 사람에게 배정은 관리자만 할 수 있습니다. 본인 또는 미배정으로 등록하세요." };
  }
  const receivedAt = text(fd, "received_at");
  const now = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("issues")
    .insert({
      customer_id,
      system_id: text(fd, "system_id"),
      inspection_id: text(fd, "inspection_id"),
      title,
      description: text(fd, "description"),
      severity: oneOf(fd, "severity", SEVERITIES) ?? "보통",
      channel: oneOf(fd, "channel", CHANNELS),
      requester: text(fd, "requester"),
      received_at: receivedAt ? kstInputToIso(receivedAt) : now,
      reporter_id: user.id,
      ...(assignee_id ? { assignee_id, status: "assigned", assigned_at: now } : {}),
    })
    .select("id, number")
    .single();
  const err = fail(error, "이슈 등록");
  if (err || !data) return err ?? { error: "이슈 등록 실패" };
  await log(data.id, user, "status", "이슈를 등록했습니다.");
  redirect(`/issues/${data.id}`);
}

export async function updateIssue(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = text(fd, "id");
  const title = text(fd, "title");
  if (!id || !title) return { error: "제목을 입력하세요." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("issues")
    .update({
      title,
      description: text(fd, "description"),
      severity: oneOf(fd, "severity", SEVERITIES) ?? "보통",
      channel: oneOf(fd, "channel", CHANNELS),
      requester: text(fd, "requester"),
      system_id: text(fd, "system_id"),
    })
    .eq("id", id);
  const err = fail(error, "수정");
  if (err) return err;
  await log(id, user, "edit", "이슈 내용을 수정했습니다.");
  refresh();
  return { ok: "수정했습니다." };
}

// ── 배정 ───────────────────────────────────────────────────────────
export async function assignIssue(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = text(fd, "id");
  if (!id) return { error: "이슈를 찾을 수 없습니다." };
  const me = await myStaffId(user);
  const target = text(fd, "assignee_id") === "me" ? me : text(fd, "assignee_id");
  if (!target) return { error: me ? "담당자를 선택하세요." : "직원 명단에 연결된 계정이 아니라 맡을 수 없습니다. 관리자에게 문의하세요." };

  const supabase = await createClient();
  const { data: cur } = await supabase.from("issues").select("status, assignee_id").eq("id", id).single();
  if (!cur) return { error: "이슈를 찾을 수 없습니다." };
  // 엔지니어는 미배정 이슈를 본인이 맡는 것만 할 수 있다
  if (user.role !== "admin" && !(target === me && !cur.assignee_id)) {
    return { error: "배정 변경은 관리자만 할 수 있습니다." };
  }
  const { data: staff } = await supabase.from("staff").select("name").eq("id", target).single();
  const patch: TablesUpdate<"issues"> = { assignee_id: target, assigned_at: new Date().toISOString() };
  if (cur.status === "received") patch.status = "assigned";
  const { error } = await supabase.from("issues").update(patch).eq("id", id);
  const err = fail(error, "배정");
  if (err) return err;
  await log(id, user, "assign", `담당자: ${staff?.name ?? "?"}`);
  refresh();
  return { ok: `${staff?.name}에게 배정했습니다.` };
}

// ── 상태 ───────────────────────────────────────────────────────────
export async function startIssue(fd: FormData) {
  const user = await requireStaff();
  const id = String(fd.get("id"));
  const r = await loadForChange(id, user);
  if ("error" in r || !r.canChange || r.issue.status !== "assigned") return;
  const supabase = await createClient();
  await supabase.from("issues").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", id);
  await log(id, user, "status", `상태: ${ISSUE_STATUS_LABEL.in_progress}`);
  refresh();
}

export async function resolveIssue(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = text(fd, "id");
  const cause = text(fd, "cause");
  const action = text(fd, "action");
  if (!id) return { error: "이슈를 찾을 수 없습니다." };
  if (!cause || !action) return { error: "원인과 조치를 모두 입력하세요. 같은 문제가 다시 생겼을 때 이 기록을 찾아 씁니다." };
  const r = await loadForChange(id, user);
  if ("error" in r) return { error: r.error };
  if (!r.canChange) return { error: "담당자나 관리자만 완료할 수 있습니다." };
  if (!r.issue.assignee_id) return { error: "먼저 담당자를 배정하세요." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("issues")
    .update({
      status: "resolved",
      cause,
      action,
      add_to_kb: fd.get("add_to_kb") === "on",
      resolved_at: now,
      ...(r.issue.status === "assigned" ? { started_at: now } : {}),
    })
    .eq("id", id);
  const err = fail(error, "완료 처리");
  if (err) return err;
  await log(id, user, "status", `상태: ${ISSUE_STATUS_LABEL.resolved}`);
  const kb = fd.get("add_to_kb") === "on" ? await saveKbDraft(id, user) : null;
  refresh();
  return { ok: kb ? `완료했습니다. 지식베이스 초안 #${kb}을(를) 만들었습니다. 지식베이스에서 다듬어 게시해 주세요.` : "완료했습니다." };
}

// 완료한 이슈로 지식베이스 초안을 만든다. 이미 있으면 초안일 때만 원인·조치를 갱신한다.
async function saveKbDraft(issueId: string, user: CurrentUser): Promise<number | null> {
  const supabase = await createClient();
  const { data: i } = await supabase
    .from("issues")
    .select("number, title, description, cause, action, customer_id, system:customer_systems(product, version)")
    .eq("id", issueId)
    .single();
  if (!i) return null;
  const product = i.system?.product ?? null;
  const fields = {
    title: i.title,
    symptom: i.description,
    cause: i.cause,
    solution: i.action,
    updated_by: user.id,
  };
  const { data: existing } = await supabase
    .from("kb_articles")
    .select("id, number, status")
    .eq("source_issue_id", issueId)
    .maybeSingle();
  if (existing) {
    if (existing.status === "draft") await supabase.from("kb_articles").update(fields).eq("id", existing.id);
    return existing.number;
  }
  const { data } = await supabase
    .from("kb_articles")
    .insert({
      ...fields,
      kind: "case",
      status: "draft",
      category: product === "Jennifer" ? "APM" : product && ["WAS", "IHS", "Liberty"].includes(product) ? "WAS" : "기타",
      product: [product, i.system?.version].filter(Boolean).join(" ") || null,
      customer_id: i.customer_id,
      source_issue_id: issueId,
      source_note: `이슈 #${i.number}`,
      author_id: user.id,
    })
    .select("number")
    .single();
  if (data) await log(issueId, user, "edit", `지식베이스 초안 #${data.number}을(를) 만들었습니다.`);
  return data?.number ?? null;
}

export async function reopenIssue(fd: FormData) {
  const user = await requireStaff();
  const id = String(fd.get("id"));
  const r = await loadForChange(id, user);
  if ("error" in r || !r.canChange || r.issue.status !== "resolved") return;
  const supabase = await createClient();
  await supabase.from("issues").update({ status: "in_progress" satisfies IssueStatus, resolved_at: null }).eq("id", id);
  await log(id, user, "status", "완료를 취소하고 다시 처리합니다.");
  refresh();
}

// ── 댓글·첨부 ──────────────────────────────────────────────────────
export async function addComment(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = text(fd, "id");
  const body = text(fd, "body");
  if (!id || !body) return { error: "내용을 입력하세요." };
  await log(id, user, "comment", body);
  refresh();
  return { ok: "등록했습니다." };
}

export async function deleteComment(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("issue_activities").delete().eq("id", String(fd.get("id"))).eq("kind", "comment");
  refresh();
}

export async function confirmIssueFile(input: {
  issueId: string;
  path: string;
  fileName: string;
  fileSize: number;
  contentType: string | null;
}): Promise<FormState> {
  const user = await requireStaff();
  if (!input.path.startsWith(`${input.issueId}/`)) return { error: "잘못된 업로드 경로입니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("issue_files").insert({
    issue_id: input.issueId,
    storage_path: input.path,
    file_name: input.fileName,
    file_size: input.fileSize,
    content_type: input.contentType,
    uploaded_by: user.id,
  });
  const err = fail(error, "첨부");
  if (err) return err;
  refresh();
  return { ok: "첨부했습니다." };
}

export async function deleteIssueFile(fd: FormData) {
  const user = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("issue_files")
    .select("storage_path, uploaded_by")
    .eq("id", String(fd.get("id")))
    .single();
  if (!data || (data.uploaded_by !== user.id && user.role !== "admin")) return;
  await createAdminClient().storage.from("issue-files").remove([data.storage_path]);
  await supabase.from("issue_files").delete().eq("id", String(fd.get("id")));
  refresh();
}
