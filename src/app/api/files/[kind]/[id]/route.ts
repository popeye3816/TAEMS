import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 결과서·양식·이슈 첨부 다운로드. 로그인 사용자의 권한(RLS)으로 행을 조회할 수 있을 때만
// 1분짜리 서명 URL을 발급해 넘겨준다. 영업은 담당 고객사의 결과서만 조회된다.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new NextResponse("로그인이 필요합니다.", { status: 401 });

  const sources = {
    report: { table: "inspection_reports", bucket: "inspection-reports" },
    template: { table: "report_templates", bucket: "report-templates" },
    issue: { table: "issue_files", bucket: "issue-files" },
  } as const;
  const source = sources[kind as keyof typeof sources];
  if (!source) return new NextResponse("알 수 없는 파일 종류입니다.", { status: 404 });

  const { data: row } = await supabase.from(source.table).select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!row) return new NextResponse("파일이 없거나 권한이 없습니다.", { status: 404 });

  const bucket = source.bucket;
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(row.storage_path, 60, { download: row.file_name });
  if (error || !data) return new NextResponse("파일을 열 수 없습니다.", { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
