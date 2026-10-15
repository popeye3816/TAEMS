import { Suspense } from "react";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { navForRole, ROLE_LABELS } from "@/lib/roles";
import { SidebarNav } from "@/components/sidebar-nav";
import { logout } from "../login/actions";

// 바깥 틀은 정적으로 먼저 보여주고, 세션을 읽는 메뉴·사용자 정보는 Suspense 안에서 스트리밍한다.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-60 md:border-r md:border-b-0">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-blue-700">UniPoint</p>
          <p className="text-base font-bold text-slate-900">기술지원 통합관리</p>
        </div>
        <Suspense fallback={<NavSkeleton />}>
          <UserNav />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}

async function UserNav() {
  const user = await getCurrentUser();
  const items = navForRole(user.role).map(({ href, label, icon }) => ({ href, label, icon }));
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <div className="flex flex-1 flex-col justify-between gap-4 px-3 pb-4">
      <div className="space-y-1">
        <SidebarNav items={items} />
        <Link
          href="/notifications"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Bell className="size-4" aria-hidden />
          알림
          {unread ? (
            <span className="ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Link>
      </div>
      <div className="border-t border-slate-200 pt-3">
        <Link href="/account" className="block rounded-md px-3 py-1.5 text-sm hover:bg-slate-100">
          <p className="font-medium text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">
            {ROLE_LABELS[user.role]} · {user.email}
          </p>
        </Link>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="size-4" aria-hidden />
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}

function NavSkeleton() {
  return (
    <div className="space-y-2 px-3 pb-4" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}
