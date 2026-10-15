// 사용자 계정을 만든다. 최초 관리자 생성용.
// 사용법: npm run create-user -- --email chlee@unipoint.co.kr --name 이충호 --role admin --password '임시비밀번호'
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "engineer" },
    password: { type: "string" },
  },
});

const { email, name, role, password } = values;
if (!email || !name || !password) {
  console.error("필수: --email --name --password (선택: --role admin|engineer|sales)");
  process.exit(1);
}
if (!["admin", "engineer", "sales"].includes(role)) {
  console.error(`알 수 없는 역할: ${role}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error(".env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY가 필요합니다.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: { name },
  app_metadata: { role },
});

if (error) {
  console.error(`실패: ${error.message}`);
  process.exit(1);
}
console.log(`생성됨: ${data.user.email} (${role})`);
