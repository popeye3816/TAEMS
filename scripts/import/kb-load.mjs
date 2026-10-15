// .import/kb.json을 지식베이스에 넣는다. 같은 출처(source_note)는 다시 넣지 않는다.
//   node --env-file=.env.local scripts/import/kb-load.mjs           미리보기
//   node --env-file=.env.local scripts/import/kb-load.mjs --apply   적재
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const items = JSON.parse(readFileSync(".import/kb.json", "utf8"));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const norm = (s) => (s ?? "").toLowerCase().replace(/[\s()·\-_/]/g, "");

async function main() {
  const [{ data: existing }, { data: profiles }, { data: customers }] = await Promise.all([
    db.from("kb_articles").select("source_note"),
    db.from("profiles").select("id, name"),
    db.from("customers").select("id, name"),
  ]);
  const done = new Set((existing ?? []).map((e) => e.source_note));
  const fresh = items.filter((i) => !done.has(i.source_note));

  const rows = fresh.map((i) => {
    const author = profiles.filter((p) => p.name === i.author_name);
    // 이름이 정확히 같은 고객사를 먼저, 없으면 부분 일치가 하나뿐일 때만 연결
    const exact = customers.filter((c) => norm(c.name) === norm(i.customer_name));
    const customer = !i.customer_name
      ? []
      : exact.length
        ? exact
        : customers.filter((c) => norm(c.name).includes(norm(i.customer_name)) || norm(i.customer_name).includes(norm(c.name)));
    return {
      kind: i.kind,
      status: i.status,
      title: i.title,
      category: i.category,
      product: i.product,
      environment: i.environment,
      tags: i.tags,
      symptom: i.symptom ?? null,
      cause: i.cause ?? null,
      solution: i.solution ?? null,
      content: i.content ?? null,
      source_note: i.source_note,
      author_id: author.length === 1 ? author[0].id : null,
      customer_id: customer.length === 1 ? customer[0].id : null,
    };
  });

  console.log(`${APPLY ? "[적재]" : "[미리보기]"} 전체 ${items.length}건, 이미 있음 ${items.length - fresh.length}건, 새로 넣을 것 ${rows.length}건`);
  for (const r of rows) console.log(`  ${r.status === "draft" ? "초안" : "게시"}  ${r.title.slice(0, 50)}${r.customer_id ? "  (고객사 연결)" : ""}`);
  if (!APPLY) return console.log("실제로 넣으려면 --apply를 붙이세요.");
  if (rows.length) {
    const { error } = await db.from("kb_articles").insert(rows);
    if (error) throw error;
  }
  console.log("적재 완료");
}

await main();
