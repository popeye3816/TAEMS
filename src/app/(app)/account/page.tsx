import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { PasswordForm } from "./password-form";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { saveNotifyPrefs } from "../notifications/actions";

export default function AccountPage() {
  return (
    <>
      <PageHeader title="내 계정" description="처음 받은 임시 비밀번호는 바로 변경하세요." />
      <Suspense fallback={<ContentSkeleton />}>
        <AccountContent />
      </Suspense>
    </>
  );
}

async function AccountContent() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("profiles")
    .select("notify_email, notify_kakaowork")
    .eq("id", user.id)
    .single();
  return (
    <div className="space-y-6">
      <dl className="card grid max-w-md grid-cols-[6rem_1fr] gap-y-2 p-5 text-sm">
        <dt className="text-slate-500">이름</dt>
        <dd>{user.name}</dd>
        <dt className="text-slate-500">이메일</dt>
        <dd>{user.email}</dd>
        <dt className="text-slate-500">역할</dt>
        <dd>{ROLE_LABELS[user.role]}</dd>
      </dl>
      <PasswordForm />
      <section className="card max-w-md p-5">
        <h2 className="text-sm font-semibold text-slate-900">알림 받기</h2>
        <p className="mt-0.5 text-xs text-slate-500">시스템 안의 알림(왼쪽 메뉴의 종)은 항상 받습니다.</p>
        <div className="mt-3">
          <ActionForm action={saveNotifyPrefs}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notify_email" defaultChecked={prefs?.notify_email ?? true} /> 메일 ({user.email})
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notify_kakaowork" defaultChecked={prefs?.notify_kakaowork ?? true} /> 카카오워크 메시지
            </label>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
