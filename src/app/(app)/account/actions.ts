"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { ok?: string; error?: string } | undefined;

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await getCurrentUser();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (password !== confirm) return { error: "두 비밀번호가 서로 다릅니다." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const same = /different from the old|same/i.test(error.message);
    return { error: same ? "기존 비밀번호와 다른 비밀번호를 입력하세요." : `변경 실패: ${error.message}` };
  }
  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  refresh();
  return { ok: "비밀번호를 변경했습니다." };
}
