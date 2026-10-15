import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 결과서·양식 다운로드. 로그인 사용자의 권한(RLS)으로 행을 조회할 수 있을 때만
// 1분짜리 서명 URL을 발급해 넘겨준다. 영업은 담당 고객사의 결과서만 조회된다.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new NextResponse("로그인이 필요합니다.", { status: 401 });

  const lookup =
    kind === "report"
      ? await supabase.from("inspection_reports").select("storage_path, file_name").eq("id", id).maybeSingle()
      : kind === "template"
        ? await supabase.from("report_templates").select("storage_path, file_name").eq("id", id).maybeSingle()
        : null;
  const row = lookup?.data;
  if (!row) return new NextResponse("파일이 없거나 권한이 없습니다.", { status: 404 });

  const bucket = kind === "report" ? "inspection-reports" : "report-templates";
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(row.storage_path, 60, { download: row.file_name });
  if (error || !data) return new NextResponse("파일을 열 수 없습니다.", { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
