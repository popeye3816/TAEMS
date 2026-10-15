import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 알림을 읽음으로 표시하고 해당 화면으로 이동한다
export async function GET(req: NextRequest, ctx: RouteContext<"/notifications/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("link")
    .maybeSingle();
  const link = data?.link?.startsWith("/") && !data.link.startsWith("//") ? data.link : "/notifications";
  return NextResponse.redirect(new URL(link, req.url));
}
