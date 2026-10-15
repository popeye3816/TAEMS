import { Suspense } from "react";
import clsx from "clsx";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pathRoles, ROLE_LABELS, ROLES } from "@/lib/roles";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { CreateUserForm } from "./create-user-form";
import { updateUser } from "./actions";
import { ChannelSection, StaffSection } from "./staff-section";
import { BulkCreateForm, ResetPasswordButton } from "./bulk-forms";

export default function UsersPage() {
  return (
    <>
      <PageHeader title="사용자 관리" description="계정·역할, 직원 명단(알림 받을 이메일), 알림 채널을 관리합니다." />
      <Suspense fallback={<ContentSkeleton />}>
        <UsersContent />
      </Suspense>
    </>
  );
}

async function UsersContent() {
  const me = await requireRole(pathRoles("/admin/users"));
  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, name, role, is_active, created_at, must_change_password")
    .order("role")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <CreateUserForm />
        <BulkCreateForm />
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-700">목록을 불러오지 못했습니다: {error.message}</p>}
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">이메일</th>
              <th className="px-4 py-2.5 font-medium">역할 · 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users?.map((u) => {
              const isMe = u.id === me.id;
              return (
                <tr key={u.id} className={clsx(!u.is_active && "text-slate-400")}>
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                    {isMe && <span className="ml-1.5 text-xs text-blue-700">(나)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.email}
                    {u.must_change_password && <p className="text-xs text-amber-700">임시 비밀번호 사용 중</p>}
                    {!isMe && <ResetPasswordButton id={u.id} name={u.name} />}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateUser} className="flex flex-wrap items-center gap-3">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        disabled={isMe}
                        aria-label={`${u.name} 역할`}
                        className="input w-28 py-1"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked={u.is_active} disabled={isMe} />
                        활성
                      </label>
                      {!isMe && (
                        <button type="submit" className="btn-secondary py-1">
                          저장
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StaffSection />
      <ChannelSection />
    </div>
  );
}
