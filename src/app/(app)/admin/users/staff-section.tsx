import clsx from "clsx";
import { createClient } from "@/lib/supabase/server";
import { channelStatus } from "@/lib/notify";
import { formatDateTime } from "@/lib/format";
import { ActionForm, Field } from "@/components/action-form";
import { saveStaff, sendTestNotification } from "../../notifications/actions";

const KIND_LABEL = { engineer: "엔지니어", sales: "영업" } as const;

// 직원 명단: 계정이 없는 직원(주로 영업)에게도 메일·카카오워크로 알림을 보내려면 이메일이 필요하다
export async function StaffSection() {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, kind, email, is_active, profile:profiles(email)")
    .order("kind")
    .order("name");

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900">직원 명단</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        담당 엔지니어·영업으로 지정되는 사람들입니다. 계정이 없는 영업 담당자도 이메일을 넣으면 결과서 업로드 알림을 메일·카카오워크로 받습니다.
        같은 이름으로 계정을 만들면 자동으로 연결됩니다.
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {(staff ?? []).map((s) => (
          <li key={s.id} className={clsx("py-2", !s.is_active && "opacity-60")}>
            <ActionForm action={saveStaff} submitLabel="저장" className="flex flex-wrap items-center gap-3 space-y-0">
              <input type="hidden" name="id" value={s.id} />
              <span className="w-28 text-sm font-medium">
                {s.name} <span className="text-xs font-normal text-slate-500">{KIND_LABEL[s.kind]}</span>
              </span>
              {s.profile ? (
                <span className="w-64 text-sm text-slate-600">
                  {s.profile.email} <span className="text-xs text-emerald-700">계정 연결</span>
                </span>
              ) : (
                <input
                  name="email"
                  type="email"
                  defaultValue={s.email ?? ""}
                  placeholder="name@unipoint.co.kr"
                  aria-label={`${s.name} 이메일`}
                  className="input w-64 py-1"
                />
              )}
              {s.profile && <input type="hidden" name="email" value={s.email ?? s.profile.email} />}
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={s.is_active} /> 재직
              </label>
            </ActionForm>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-blue-700">직원 추가 (계정 없이 담당자로만 지정)</summary>
        <div className="mt-3">
          <ActionForm action={saveStaff} submitLabel="추가" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="이름 *">
                <input name="name" required className="input" />
              </Field>
              <Field label="구분">
                <select name="kind" className="input">
                  <option value="sales">영업</option>
                  <option value="engineer">엔지니어</option>
                </select>
              </Field>
              <Field label="이메일">
                <input name="email" type="email" className="input" />
              </Field>
            </div>
          </ActionForm>
        </div>
      </details>
    </section>
  );
}

export async function ChannelSection() {
  const ch = channelStatus();
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("notification_deliveries")
    .select("id, channel, recipient, title, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const items = [
    { key: "email", label: "메일", ok: ch.email, env: "RESEND_API_KEY, MAIL_FROM" },
    { key: "kakaowork", label: "카카오워크 (개인 메시지)", ok: ch.kakaowork, env: "KAKAOWORK_BOT_KEY" },
    { key: "slack", label: "Slack (팀 채널)", ok: ch.slack, env: "SLACK_WEBHOOK_URL" },
  ];

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">알림 채널</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          시스템 안의 알림은 항상 동작합니다. 외부 채널은 Vercel 환경변수를 넣으면 켜집니다. 매일 아침 8시에 점검 D-3, 지연 이슈, 월말 미완료, 계약 만료 60일 전 알림을 보냅니다.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.key} className={clsx("rounded-lg border px-3 py-2 text-sm", i.ok ? "border-emerald-200 bg-emerald-50" : "border-slate-200")}>
            <p className="font-medium">{i.label}</p>
            <p className={clsx("text-xs", i.ok ? "text-emerald-700" : "text-slate-500")}>{i.ok ? "설정됨" : `미설정 (${i.env})`}</p>
          </li>
        ))}
      </ul>
      <ActionForm action={sendTestNotification} submitLabel="나에게 시험 알림 보내기">
        <span />
      </ActionForm>
      {(logs ?? []).length > 0 && (
        <div className="overflow-x-auto">
          <h3 className="mb-1 text-xs font-semibold text-slate-500">최근 외부 발송 기록</h3>
          <table className="w-full min-w-[640px] text-xs">
            <tbody className="divide-y divide-slate-100">
              {logs!.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 pr-2 text-slate-500">{formatDateTime(l.created_at)}</td>
                  <td className="pr-2">{l.channel}</td>
                  <td className="pr-2">{l.recipient}</td>
                  <td className="max-w-64 truncate pr-2">{l.title}</td>
                  <td className={clsx("pr-2 font-medium", l.status === "sent" ? "text-emerald-700" : l.status === "failed" ? "text-red-700" : "text-slate-400")}>
                    {l.status === "sent" ? "발송" : l.status === "failed" ? "실패" : "건너뜀"}
                  </td>
                  <td className="max-w-64 truncate text-slate-500" title={l.error ?? undefined}>{l.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
