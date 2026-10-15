import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 알림 발송. 시스템 내 알림은 항상, 메일·카카오워크·Slack은 환경변수가 있을 때만 보낸다.
//   RESEND_API_KEY, MAIL_FROM          메일 (Resend)
//   KAKAOWORK_BOT_KEY                  카카오워크 봇 → 회사 이메일로 개인 메시지
//   SLACK_WEBHOOK_URL                  Slack 팀 채널 (Incoming Webhook)
//   APP_URL                            메시지 속 링크 주소 (예: https://taems.vercel.app)

export type Recipient = {
  profileId?: string | null;
  email?: string | null;
  name?: string | null;
  emailOn?: boolean;
  kakaoOn?: boolean;
};

export type NotifyInput = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  recipients: Recipient[];
  dedupeKey?: string; // 같은 키로는 한 번만 보낸다 (정기 알림용)
  team?: boolean; // Slack 팀 채널에도 올린다
};

export function channelStatus() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
    kakaowork: Boolean(process.env.KAKAOWORK_BOT_KEY),
    slack: Boolean(process.env.SLACK_WEBHOOK_URL),
  };
}

const appUrl = () => (process.env.APP_URL ?? "https://taems.vercel.app").replace(/\/$/, "");

export async function notify(input: NotifyInput) {
  const db = createAdminClient();
  const url = input.link ? `${appUrl()}${input.link}` : appUrl();
  const text = [input.title, input.body, url].filter(Boolean).join("\n");
  const ch = channelStatus();

  // 같은 사람에게 두 번 가지 않도록 정리 (계정 기준, 없으면 이메일 기준)
  const seen = new Set<string>();
  const recipients = input.recipients.filter((r) => {
    const key = r.profileId ?? r.email?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const r of recipients) {
    const who = r.profileId ?? r.email!;
    const dedupe = input.dedupeKey ? `${input.dedupeKey}:${who}` : null;

    if (r.profileId) {
      const { error } = await db.from("notifications").insert({
        user_id: r.profileId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        dedupe_key: dedupe,
      });
      if (error?.code === "23505") continue; // 이미 보낸 알림
    }

    if (r.email && r.emailOn !== false) {
      await deliver(db, input, "email", r.email, dedupe, ch.email, () => sendEmail(r.email!, input.title, text, url));
    }
    if (r.email && r.kakaoOn !== false) {
      await deliver(db, input, "kakaowork", r.email, dedupe, ch.kakaowork, () => sendKakaoWork(r.email!, text));
    }
  }

  if (input.team) {
    await deliver(db, input, "slack", "team", input.dedupeKey ? `${input.dedupeKey}:team` : null, ch.slack, () =>
      sendSlack(text),
    );
  }
}

type Db = ReturnType<typeof createAdminClient>;

async function deliver(
  db: Db,
  input: NotifyInput,
  channel: "email" | "kakaowork" | "slack",
  recipient: string,
  dedupe: string | null,
  configured: boolean,
  send: () => Promise<void>,
) {
  const key = dedupe ? `${dedupe}:${channel}` : null;
  if (key) {
    const { data } = await db.from("notification_deliveries").select("id").eq("dedupe_key", key).maybeSingle();
    if (data) return;
  }
  let status: "sent" | "failed" | "skipped" = "skipped";
  let error: string | null = configured ? null : "미설정";
  if (configured) {
    try {
      await send();
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message.slice(0, 500) : String(e);
    }
  }
  await db.from("notification_deliveries").insert({
    type: input.type,
    channel,
    recipient,
    title: input.title,
    status,
    error,
    dedupe_key: key,
  });
}

async function sendEmail(to: string, subject: string, text: string, url: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to,
      subject: `[TAEMS] ${subject}`,
      text,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${escapeHtml(text).replace(/\n/g, "<br>")}<p><a href="${url}">시스템에서 보기</a></p><p style="color:#888;font-size:12px">기술지원 통합관리 시스템에서 보낸 메일입니다. 수신 설정은 '내 계정'에서 바꿀 수 있습니다.</p></div>`,
    }),
  });
  if (!res.ok) throw new Error(`메일 발송 실패 ${res.status}: ${await res.text()}`);
}

async function sendKakaoWork(email: string, text: string) {
  const res = await fetch("https://api.kakaowork.com/v1/messages.send_by_email", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.KAKAOWORK_BOT_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(`카카오워크 발송 실패 ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
}

async function sendSlack(text: string) {
  const res = await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack 발송 실패 ${res.status}: ${await res.text()}`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// ── 받는 사람 찾기 ─────────────────────────────────────────────────
// 직원(staff): 계정이 있으면 계정의 이메일·수신 설정을, 없으면 직원 명단의 이메일을 쓴다
export async function staffRecipients(staffIds: (string | null | undefined)[]): Promise<Recipient[]> {
  const ids = [...new Set(staffIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return [];
  const { data } = await createAdminClient()
    .from("staff")
    .select("name, email, profile:profiles(id, email, is_active, notify_email, notify_kakaowork)")
    .in("id", ids);
  return (data ?? []).map((s) =>
    s.profile && s.profile.is_active
      ? { profileId: s.profile.id, email: s.profile.email, name: s.name, emailOn: s.profile.notify_email, kakaoOn: s.profile.notify_kakaowork }
      : { email: s.email, name: s.name },
  );
}

export async function adminRecipients(): Promise<Recipient[]> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, email, name, notify_email, notify_kakaowork")
    .eq("role", "admin")
    .eq("is_active", true);
  return (data ?? []).map((p) => ({
    profileId: p.id,
    email: p.email,
    name: p.name,
    emailOn: p.notify_email,
    kakaoOn: p.notify_kakaowork,
  }));
}
