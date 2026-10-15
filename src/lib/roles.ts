export const ROLES = ["admin", "engineer", "sales"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "관리자",
  engineer: "엔지니어",
  sales: "영업",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type NavIcon =
  | "dashboard"
  | "customers"
  | "schedule"
  | "issues"
  | "kb"
  | "workload"
  | "reports"
  | "users";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  roles: readonly Role[];
};

// 메뉴와 페이지 접근 권한을 한곳에서 정의한다. 페이지는 requireRole(pathRoles(...))로 같은 값을 쓴다.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: "dashboard", roles: ["admin", "engineer", "sales"] },
  { href: "/customers", label: "고객사", icon: "customers", roles: ["admin", "engineer"] },
  { href: "/schedule", label: "월별 일정", icon: "schedule", roles: ["admin", "engineer"] },
  { href: "/issues", label: "이슈", icon: "issues", roles: ["admin", "engineer"] },
  { href: "/kb", label: "지식베이스", icon: "kb", roles: ["admin", "engineer"] },
  { href: "/reports", label: "점검결과서", icon: "reports", roles: ["admin", "engineer", "sales"] },
  { href: "/workload", label: "업무량", icon: "workload", roles: ["admin"] },
  { href: "/admin/users", label: "사용자 관리", icon: "users", roles: ["admin"] },
];

export function navForRole(role: Role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function pathRoles(href: string): readonly Role[] {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`메뉴에 없는 경로: ${href}`);
  return item.roles;
}

export const ALLOWED_EMAIL_DOMAIN = "unipoint.co.kr";
