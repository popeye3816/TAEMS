// 운영 DB와 파일을 이 PC에 내려받아 둔다 (Supabase 무료 플랜은 자동 백업을 내려받을 수 없음).
//   npm run backup             표(JSON)만
//   npm run backup -- --files  결과서·양식·이슈 첨부 파일까지
// 결과: backups/<날짜-시각>/ (git에 올라가지 않음). 암호화된 IP·계정은 암호문 그대로 저장되며
// 읽으려면 같은 ENCRYPTION_KEY가 필요하다.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const WITH_FILES = process.argv.includes("--files");
const TABLES = [
  "profiles", "staff", "customers", "customer_contacts", "customer_systems", "contracts",
  "engineer_assignments", "customer_credentials", "secret_access_logs",
  "inspection_plans", "inspections", "inspection_reports", "report_templates",
  "issues", "issue_activities", "issue_files",
  "kb_articles", "kb_helpful", "notifications", "notification_deliveries",
];
const BUCKETS = ["inspection-reports", "report-templates", "issue-files"];

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const stamp = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date()).replace(" ", "-").replace(":", "");
const dir = join("backups", stamp);
mkdirSync(dir, { recursive: true });

async function all(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function listFiles(bucket, prefix = "") {
  const out = [];
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`${bucket}: ${error.message}`);
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) out.push(path);
    else out.push(...(await listFiles(bucket, path))); // 폴더
  }
  return out;
}

const summary = { created_at: new Date().toISOString(), tables: {}, files: {} };
for (const t of TABLES) {
  const rows = await all(t);
  writeFileSync(join(dir, `${t}.json`), JSON.stringify(rows, null, 1));
  summary.tables[t] = rows.length;
}
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
writeFileSync(join(dir, "auth_users.json"), JSON.stringify(users.users.map((u) => ({ id: u.id, email: u.email, app_metadata: u.app_metadata, created_at: u.created_at })), null, 1));
summary.tables.auth_users = users.users.length;

for (const b of BUCKETS) {
  const files = await listFiles(b);
  summary.files[b] = files.length;
  if (!WITH_FILES) continue;
  for (const path of files) {
    const { data, error } = await db.storage.from(b).download(path);
    if (error) throw new Error(`${b}/${path}: ${error.message}`);
    const target = join(dir, "files", b, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await data.arrayBuffer()));
  }
}
writeFileSync(join(dir, "_summary.json"), JSON.stringify(summary, null, 2));
console.log(`백업 완료: ${dir}`);
console.log("표:", Object.entries(summary.tables).map(([k, v]) => `${k} ${v}`).join(", "));
console.log(`파일: ${Object.entries(summary.files).map(([k, v]) => `${k} ${v}`).join(", ")}${WITH_FILES ? " (내려받음)" : " (목록만, 파일까지 받으려면 --files)"}`);
