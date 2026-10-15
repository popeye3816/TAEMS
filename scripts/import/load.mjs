// extract.py가 만든 .import/extracted.json을 Supabase에 적재한다.
// 사용법:
//   node --env-file=.env.local scripts/import/load.mjs           미리보기 (DB에 쓰지 않음)
//   node --env-file=.env.local scripts/import/load.mjs --apply   실제 적재
//
// 여러 번 실행해도 된다. 고객사는 이름, 계약은 계약번호 기준으로 갱신하고,
// 엑셀에서 온 담당자·시스템(source='excel')은 지우고 다시 넣는다. 화면에서 직접 입력한 항목은 건드리지 않는다.
import { readFileSync } from "node:fs";
import { createCipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const data = JSON.parse(readFileSync(".import/extracted.json", "utf8"));

// src/lib/crypto.ts와 같은 형식: v1:<iv>:<tag>:<암호문>
const KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
if (KEY.length !== 32) throw new Error("ENCRYPTION_KEY(32바이트 base64)가 필요합니다.");
function encrypt(plain) {
  if (!plain) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

function check(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

const customers = data.customers;
const contacts = customers.flatMap((c) => c.contacts.map((p) => ({ ...p, customer: c.name })));
const systems = customers.flatMap((c) => c.systems.map((x) => ({ ...x, customer: c.name })));
const assignments = customers.flatMap((c) => c.assignments.map((a) => ({ ...a, customer: c.name })));

console.log(`${APPLY ? "[적재]" : "[미리보기]"} 엑셀 추출 시각 ${data.generated_at}`);
console.log(`  직원 ${data.staff.length}명, 고객사 ${customers.length}곳, 담당자 ${contacts.length}명, 시스템 ${systems.length}건, 계약 ${data.contracts.length}건, 배정 ${assignments.length}건`);

if (!APPLY) {
  await preview();
} else {
  await apply();
}

async function preview() {
  const existing = check(await db.from("customers").select("name"), "고객사 조회");
  const names = new Set(existing.map((r) => r.name));
  const fresh = customers.filter((c) => !names.has(c.name)).length;
  console.log(`  DB 현재 고객사 ${names.size}곳 → 새로 추가 ${fresh}곳, 갱신 ${customers.length - fresh}곳`);
  console.log("실제로 넣으려면 --apply를 붙여 다시 실행하세요.");
}

async function apply() {

// 1) 직원 명단 + 계정 연결(이름이 같은 계정이 하나뿐일 때)
check(await db.from("staff").upsert(data.staff, { onConflict: "name,kind", ignoreDuplicates: true }), "직원 등록");
const staff = check(await db.from("staff").select("id, name, kind, profile_id"), "직원 조회");
const profiles = check(await db.from("profiles").select("id, name, role"), "계정 조회");
for (const s of staff.filter((x) => !x.profile_id)) {
  const kindRoles = s.kind === "sales" ? ["sales"] : ["admin", "engineer"];
  const matches = profiles.filter((p) => p.name === s.name && kindRoles.includes(p.role));
  if (matches.length === 1) {
    check(await db.from("staff").update({ profile_id: matches[0].id }).eq("id", s.id), "직원-계정 연결");
    console.log(`  직원 ${s.name} ↔ 계정 연결`);
  }
}
const staffId = (name, kind) => staff.find((s) => s.name === name && s.kind === kind)?.id ?? null;

// 2) 고객사
const customerRows = customers.map((c) => ({
  name: c.name,
  group_name: c.group_name ?? null,
  status: c.status ?? "active",
  business_unit: c.business_unit ?? null,
  sales_rep_id: c.sales_rep ? staffId(c.sales_rep, "sales") : null,
  importance: c.importance ?? null,
  service_difficulty: c.service_difficulty ?? null,
  support_level: c.support_level ?? null,
  remote_access: c.remote_access ?? null,
  business_scope: c.business_scope ?? null,
  products: c.products,
  product_versions: c.product_versions ?? null,
  annual_amount: c.annual_amount ?? null,
  inspection_cycle_note: c.inspection_cycle_note ?? null,
  support_count_note: c.support_count_note ?? null,
  address: c.address ?? null,
  visit_procedure: c.visit_procedure ?? null,
  support_method: c.support_method ?? null,
  inspection_method: c.inspection_method ?? null,
  incident_procedure: c.incident_procedure ?? null,
  contact_temperament: c.contact_temperament ?? null,
  system_env_note: c.system_env_note ?? null,
  extra_requirements: c.extra_requirements ?? null,
  site_notes: c.site_notes ?? null,
  notes: c.notes ?? null,
}));
const saved = check(await db.from("customers").upsert(customerRows, { onConflict: "name" }).select("id, name"), "고객사 저장");
const customerId = Object.fromEntries(saved.map((r) => [r.name, r.id]));
const ids = Object.values(customerId);

// 3) 엑셀에서 온 담당자·시스템은 지우고 다시 넣는다
check(await db.from("customer_contacts").delete().eq("source", "excel").in("customer_id", ids), "기존 담당자 정리");
check(await db.from("customer_systems").delete().eq("source", "excel").in("customer_id", ids), "기존 시스템 정리");

check(await db.from("customer_contacts").insert(contacts.map((p) => ({
  customer_id: customerId[p.customer],
  name: p.name,
  title: p.title ?? null,
  organization: p.organization ?? null,
  phone: p.phone ?? null,
  email: p.email ?? null,
  is_primary: Boolean(p.is_primary),
  is_active: p.is_active !== false,
  note: p.note ?? null,
  source: "excel",
}))), "담당자 저장");

check(await db.from("customer_systems").insert(systems.map((x) => ({
  customer_id: customerId[x.customer],
  business_name: x.business_name ?? null,
  ip_enc: encrypt(x.ip),
  product: x.product,
  version: x.version ?? null,
  note: x.note ?? null,
  source: "excel",
}))), "시스템 저장");

// 4) 배정: 배정 기록이 하나도 없는 고객사에만 넣는다 (화면에서 바꾼 배정을 덮어쓰지 않도록)
const existingAssign = check(await db.from("engineer_assignments").select("customer_id").in("customer_id", ids), "배정 조회");
const hasAssign = new Set(existingAssign.map((a) => a.customer_id));
const newAssign = assignments
  .filter((a) => !hasAssign.has(customerId[a.customer]))
  .map((a) => ({
    customer_id: customerId[a.customer],
    staff_id: staffId(a.engineer, "engineer"),
    role: a.role,
    started_on: a.ended_on && a.started_on > a.ended_on ? a.ended_on : a.started_on,
    ended_on: a.ended_on,
    note: a.note,
  }))
  .filter((a) => a.staff_id);
if (newAssign.length) check(await db.from("engineer_assignments").insert(newAssign), "배정 저장");

// 5) 계약
check(await db.from("contracts").upsert(data.contracts.map((k) => ({
  contract_no: k.contract_no,
  customer_id: k.customer ? customerId[k.customer] ?? null : null,
  contractor: k.contractor,
  end_user: k.end_user,
  description: k.description,
  start_date: k.start_date,
  end_date: k.end_date,
  period_text: k.period_text,
  amount: k.amount,
  products: k.products,
  billing_note: k.billing_note,
  sales_team: k.sales_team,
  sales_rep_id: k.sales_rep ? staffId(k.sales_rep, "sales") : null,
  auto_renew: k.auto_renew,
  source: "excel",
})), { onConflict: "contract_no" }), "계약 저장");

console.log(`완료: 고객사 ${saved.length}곳, 담당자 ${contacts.length}명, 시스템 ${systems.length}건, 배정 ${newAssign.length}건, 계약 ${data.contracts.length}건`);
}
