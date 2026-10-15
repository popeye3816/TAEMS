import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

// 요청당 한 번만 조회한다(Data Access Layer). 세션을 읽으므로 반드시 <Suspense> 안에서 호출한다.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name, role, is_active, must_change_password")
    .eq("id", userId)
    .single();

  if (!profile || !profile.is_active || !isRole(profile.role)) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    mustChangePassword: profile.must_change_password,
  };
});

// 페이지·서버 액션에서 역할을 확인한다. 권한이 없으면 대시보드로 돌려보낸다.
export async function requireRole(roles: readonly Role[]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect("/?denied=1");
  return user;
}
