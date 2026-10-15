"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_EMAIL_DOMAIN, isRole, pathRoles } from "@/lib/roles";

export type ActionState = { ok?: string; error?: string } | undefined;

const requireAdmin = () => requireRole(pathRoles("/admin/users"));

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role");
  const password = String(formData.get("password") ?? "");

  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return { error: `회사 이메일(@${ALLOWED_EMAIL_DOMAIN})만 등록할 수 있습니다.` };
  }
  if (!name) return { error: "이름을 입력하세요." };
  if (!isRole(role)) return { error: "역할을 선택하세요." };
  if (password.length < 8) return { error: "임시 비밀번호는 8자 이상이어야 합니다." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role },
  });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return { error: exists ? "이미 등록된 이메일입니다." : `등록 실패: ${error.message}` };
  }

  revalidatePath("/admin/users");
  return { ok: `${name}(${email}) 계정을 만들었습니다. 임시 비밀번호를 본인에게 전달하세요.` };
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
