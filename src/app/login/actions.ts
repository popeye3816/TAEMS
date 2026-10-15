"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string } | undefined;

// 외부 사이트로 돌려보내지 않도록 내부 경로만 허용한다.
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력하세요.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 400(잘못된 자격증명)이 아니면 인증 서버 연결 문제로 본다.
    const message =
      error.status === 400
        ? "이메일 또는 비밀번호가 올바르지 않습니다."
        : "인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.";
    return { error: message, email };
  }

  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
