"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_EMAIL_DOMAIN, ROLE_LABELS, isRole, pathRoles, type Role } from "@/lib/roles";

export type ActionState = { ok?: string; error?: string } | undefined;
export type IssuedPassword = { name: string; email: string; role: string; password?: string; error?: string };
export type BulkState = { results?: IssuedPassword[]; error?: string } | undefined;

const requireAdmin = () => requireRole(pathRoles("/admin/users"));

// 헷갈리는 글자(0/O, 1/l/I)를 뺀 임시 비밀번호
function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join("") + randomInt(10, 99);
}

async function createAccount(name: string, email: string, role: Role, password: string): Promise<string | null> {
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return `회사 이메일(@${ALLOWED_EMAIL_DOMAIN})만 등록할 수 있습니다.`;
  if (!name) return "이름이 없습니다.";
  if (password.length < 8) return "임시 비밀번호는 8자 이상이어야 합니다.";
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role },
  });
  if (error || !data.user) {
    return /already|registered|exists/i.test(error?.message ?? "") ? "이미 등록된 이메일입니다." : `등록 실패: ${error?.message}`;
  }
  // 처음 로그인하면 비밀번호를 바꾸도록 표시
  await admin.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);
  return null;
}

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role");
  const password = String(formData.get("password") ?? "");
  if (!isRole(role)) return { error: "역할을 선택하세요." };
  const error = await createAccount(name, email, role, password);
  if (error) return { error };
  revalidatePath("/admin/users");
  return { ok: `${name}(${email}) 계정을 만들었습니다. 임시 비밀번호를 본인에게 전달하세요.` };
}

// 여러 명 한꺼번에: 한 줄에 "이름, 이메일, 역할" (역할: 관리자/엔지니어/영업)
export async function bulkCreateUsers(_prev: BulkState, formData: FormData): Promise<BulkState> {
  await requireAdmin();
  const lines = String(formData.get("lines") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: "한 줄에 한 명씩 '이름, 이메일, 역할'을 입력하세요." };
  if (lines.length > 50) return { error: "한 번에 50명까지 등록할 수 있습니다." };

  const byLabel = Object.fromEntries(Object.entries(ROLE_LABELS).map(([k, v]) => [v, k]));
  const results: IssuedPassword[] = [];
  for (const line of lines) {
    const [name = "", rawEmail = "", rawRole = "엔지니어"] = line.split(/[,\t]/).map((s) => s.trim());
    const email = rawEmail.toLowerCase();
    const role = isRole(rawRole) ? rawRole : byLabel[rawRole];
    if (!isRole(role)) {
      results.push({ name, email, role: rawRole, error: "역할은 관리자·엔지니어·영업 중 하나" });
      continue;
    }
    const password = tempPassword();
    const error = await createAccount(name, email, role, password);
    results.push(error ? { name, email, role: ROLE_LABELS[role], error } : { name, email, role: ROLE_LABELS[role], password });
  }
  revalidatePath("/admin/users");
  return { results };
}

// 임시 비밀번호 재발급 (비밀번호를 잊었을 때)
export async function resetPassword(_prev: BulkState, formData: FormData): Promise<BulkState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("name, email, role").eq("id", id).single();
  if (!p) return { error: "사용자를 찾을 수 없습니다." };
  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { error: `재발급 실패: ${error.message}` };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
  return { results: [{ name: p.name, email: p.email, role: ROLE_LABELS[p.role as Role], password }] };
}

export async function updateUser(formData: FormData) {
  const me = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const role = formData.get("role");
  const isActive = formData.get("is_active") === "on";
  if (!id || !isRole(role)) return;

  // 관리자가 자기 권한을 내리거나 자기 계정을 막아 잠기는 일을 방지한다.
  if (id === me.id && (role !== "admin" || !isActive)) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ role, is_active: isActive }).eq("id", id);
  await admin.auth.admin.updateUserById(id, {
    app_metadata: { role },
    ban_duration: isActive ? "none" : "876000h",
  });

  revalidatePath("/admin/users");
}
