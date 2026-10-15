"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BookOpen,
  Building2,
  CalendarDays,
  FileCheck2,
  LayoutDashboard,
  LifeBuoy,
  Scale,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon, NavItem } from "@/lib/roles";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  customers: Building2,
  schedule: CalendarDays,
  issues: LifeBuoy,
  kb: BookOpen,
  workload: Scale,
  reports: FileCheck2,
  users: Users,
};

export function SidebarNav({ items }: { items: Pick<NavItem, "href" | "label" | "icon">[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="주 메뉴">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
              active
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
