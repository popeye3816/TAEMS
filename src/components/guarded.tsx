import { Suspense, type ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { ContentSkeleton } from "./page-header";

// 메뉴(NAV_ITEMS)에 정의한 역할만 내용을 볼 수 있게 한다. 권한이 없으면 대시보드로 이동.
export function Guarded({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <Gate href={href}>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ href, children }: { href: string; children: ReactNode }) {
  await requireRole(pathRoles(href));
  return children;
}
