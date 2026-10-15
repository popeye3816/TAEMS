import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { PasswordForm } from "./password-form";

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
    </div>
  );
}
