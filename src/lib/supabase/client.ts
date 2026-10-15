import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// 브라우저용 클라이언트. 지금은 서버가 발급한 서명 URL로 파일을 직접 올릴 때만 쓴다.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
