import "server-only";
import { createClient } from "@supabase/supabase-js";

// service_role 키를 쓰는 관리자 클라이언트. RLS를 우회하므로
// 반드시 서버에서, 호출자 권한을 확인한 뒤에만 사용한다.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
