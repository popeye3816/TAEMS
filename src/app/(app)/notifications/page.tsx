import { Suspense } from "react";
import clsx from "clsx";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { markAllRead } from "./actions";

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="알림" description="최근 100건을 보여줍니다. 수신 채널은 '내 계정'에서 바꿀 수 있습니다." />
      <Suspense fallback={<ContentSkeleton />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <form action={markAllRead} className="flex justify-end">
          <button type="submit" className="btn-secondary">모두 읽음으로 표시 ({unread})</button>
        </form>
      )}
      {rows.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">알림이 없습니다.</p>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {rows.map((n) => (
            <li key={n.id}>
              <a
                href={`/notifications/${n.id}`}
                className={clsx("block px-4 py-3 hover:bg-slate-50", !n.read_at && "bg-blue-50/40")}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className={clsx("text-sm", n.read_at ? "text-slate-700" : "font-semibold text-slate-900")}>
                    {!n.read_at && <span className="mr-1.5 inline-block size-2 rounded-full bg-blue-600" aria-label="안 읽음" />}
                    {n.title}
                  </p>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(n.created_at)}</span>
                </div>
                {n.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-slate-500">{n.body}</p>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
