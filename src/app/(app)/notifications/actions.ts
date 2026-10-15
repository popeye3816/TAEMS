"use server";

import { refresh } from "next/cache";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelStatus, notify } from "@/lib/notify";

export type FormState = { ok?: string; error?: string } | undefined;

export async function markAllRead() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  refresh();
}

export async function saveNotifyPrefs(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notify_email: fd.get("notify_email") === "on", notify_kakaowork: fd.get("notify_kakaowork") === "on" })
    .eq("id", user.id);
  if (error) return { error: `저장 실패: ${error.message}` };
  return { ok: "저장했습니다." };
}

// 관리자: 직원 명단의 이메일·활성 상태 (계정이 없는 영업 담당자에게 메일·카카오워크로 알림을 보낼 때 사용)
export async function saveStaff(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole(["admin"]);
  const id = String(fd.get("id") ?? "");
  const email = String(fd.get("email") ?? "").trim().toLowerCase() || null;
  const name = String(fd.get("name") ?? "").trim();
  const kind = fd.get("kind") === "sales" ? "sales" : "engineer";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "이메일 형식이 아닙니다." };
  const supabase = await createClient();
  if (!id) {
    if (!name) return { error: "이름을 입력하세요." };
    const { error } = await supabase.from("staff").insert({ name, kind, email });
    if (error) return { error: /duplicate|unique/i.test(error.message) ? "이미 있는 직원입니다." : `추가 실패: ${error.message}` };
    refresh();
    return { ok: `${name}을(를) 추가했습니다.` };
  }
  const { error } = await supabase
    .from("staff")
    .update({ email, is_active: fd.get("is_active") === "on" })
    .eq("id", id);
  if (error) return { error: `저장 실패: ${error.message}` };
  refresh();
  return { ok: "저장했습니다." };
}

// 관리자: 내게 시험 알림 보내기 (채널 설정 확인용)
export async function sendTestNotification(): Promise<FormState> {
  const user = await requireRole(["admin"]);
  const { data: me } = await createAdminClient()
    .from("profiles")
    .select("notify_email, notify_kakaowork")
    .eq("id", user.id)
    .single();
  await notify({
    type: "test",
    title: "시험 알림입니다",
    body: "이 알림이 보이면 해당 채널 설정이 정상입니다.",
    link: "/notifications",
    recipients: [{ profileId: user.id, email: user.email, emailOn: me?.notify_email, kakaoOn: me?.notify_kakaowork }],
    team: true,
  });
  const ch = channelStatus();
  refresh();
  return {
    ok: `보냈습니다. 시스템 알림 ✓ · 메일 ${ch.email ? "발송" : "미설정"} · 카카오워크 ${ch.kakaowork ? "발송" : "미설정"} · Slack ${ch.slack ? "발송" : "미설정"}. 결과는 아래 발송 기록에서 확인하세요.`,
  };
}
