"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pathRoles } from "@/lib/roles";
import {
  ENVIRONMENTS,
  LEVELS,
  NARRATIVE_FIELDS,
  PRODUCTS,
  REMOTE_ACCESS,
  SUPPORT_LEVELS,
} from "@/lib/customer-fields";

export type FormState = { ok?: string; error?: string } | undefined;

const requireStaff = () => requireRole(pathRoles("/customers"));

// ── 폼 값 읽기 ─────────────────────────────────────────────────────
function text(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}
function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[]): T | null {
  const v = text(fd, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}
function int(fd: FormData, key: string) {
  const v = text(fd, key);
  if (v == null) return null;
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function fail(e: { message: string } | null, what: string): FormState {
  if (!e) return undefined;
  if (/duplicate key|unique/i.test(e.message)) return { error: `${what}: 이미 같은 이름이 있습니다.` };
  if (/row-level security|permission/i.test(e.message)) return { error: `${what}: 권한이 없습니다.` };
  return { error: `${what} 실패: ${e.message}` };
}

// ── 고객사 ─────────────────────────────────────────────────────────
export async function saveCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = text(fd, "id");
  const name = text(fd, "name");
  if (!name) return { error: "고객사 이름을 입력하세요." };

  const row = {
    name,
    group_name: text(fd, "group_name"),
    status: text(fd, "status") === "ended" ? "ended" : "active",
    business_unit: text(fd, "business_unit"),
    sales_rep_id: text(fd, "sales_rep_id"),
    importance: oneOf(fd, "importance", LEVELS),
    service_difficulty: oneOf(fd, "service_difficulty", LEVELS),
    support_level: oneOf(fd, "support_level", SUPPORT_LEVELS),
    remote_access: oneOf(fd, "remote_access", REMOTE_ACCESS),
    business_scope: text(fd, "business_scope"),
    products: fd.getAll("products").map(String).filter((p) => (PRODUCTS as readonly string[]).includes(p)),
    product_versions: text(fd, "product_versions"),
    annual_amount: int(fd, "annual_amount"),
    inspection_cycle_note: text(fd, "inspection_cycle_note"),
    support_count_note: text(fd, "support_count_note"),
    ...Object.fromEntries(NARRATIVE_FIELDS.map((f) => [f.key, text(fd, f.key)])),
    updated_by: user.id,
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("customers").update(row).eq("id", id);
    const err = fail(error, "저장");
    if (err) return err;
    redirect(`/customers/${id}`);
  }
  const { data, error } = await supabase.from("customers").insert(row).select("id").single();
  const err = fail(error, "등록");
  if (err || !data) return err ?? { error: "등록 실패" };
  redirect(`/customers/${data.id}`);
}

// ── 고객 담당자 ────────────────────────────────────────────────────
export async function saveContact(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, "id");
  const customer_id = text(fd, "customer_id");
  const name = text(fd, "name");
  if (!customer_id || !name) return { error: "이름을 입력하세요." };
  const isPrimary = fd.get("is_primary") === "on";
  const row = {
    customer_id,
    name,
    title: text(fd, "title"),
    organization: text(fd, "organization"),
    phone: text(fd, "phone"),
    email: text(fd, "email"),
    note: text(fd, "note"),
    is_primary: isPrimary,
    is_active: fd.get("is_active") !== "off",
    source: "manual" as const,
  };
  const supabase = await createClient();
  if (isPrimary) {
    await supabase.from("customer_contacts").update({ is_primary: false }).eq("customer_id", customer_id);
  }
  const { error } = id
    ? await supabase.from("customer_contacts").update(row).eq("id", id)
    : await supabase.from("customer_contacts").insert(row);
  const err = fail(error, "담당자 저장");
  if (err) return err;
  refresh();
  return { ok: "저장했습니다." };
}

export async function deleteContact(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("customer_contacts").delete().eq("id", String(fd.get("id")));
  refresh();
}

// ── 시스템 ─────────────────────────────────────────────────────────
export async function saveSystem(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, "id");
  const customer_id = text(fd, "customer_id");
  const product = oneOf(fd, "product", PRODUCTS);
  if (!customer_id || !product) return { error: "제품을 선택하세요." };

  const ip = text(fd, "ip");
  const row = {
    customer_id,
    product,
    business_name: text(fd, "business_name"),
    environment: oneOf(fd, "environment", ENVIRONMENTS),
    hostname: text(fd, "hostname"),
    os: text(fd, "os"),
    version: text(fd, "version"),
    edition: text(fd, "edition"),
    license_count: int(fd, "license_count"),
    cpu: text(fd, "cpu"),
    memory: text(fd, "memory"),
    java_version: text(fd, "java_version"),
    install_path: text(fd, "install_path"),
    log_path: text(fd, "log_path"),
    dump_path: text(fd, "dump_path"),
    note: text(fd, "note"),
    source: "manual" as const,
    // 수정할 때 IP 칸을 비워 두면 기존 값을 유지한다. 지우려면 'IP 삭제'를 체크한다.
    ...(ip ? { ip_enc: encrypt(ip) } : fd.get("ip_clear") === "on" || !id ? { ip_enc: null } : {}),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("customer_systems").update(row).eq("id", id)
    : await supabase.from("customer_systems").insert(row);
  const err = fail(error, "시스템 저장");
  if (err) return err;
  refresh();
  return { ok: "저장했습니다." };
}

export async function deleteSystem(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("customer_systems").delete().eq("id", String(fd.get("id")));
  refresh();
}

// ── 엔지니어 배정 (관리자) ─────────────────────────────────────────
export async function assignEngineer(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  if (user.role !== "admin") return { error: "배정은 관리자만 변경할 수 있습니다." };
  const customer_id = text(fd, "customer_id");
  const staff_id = text(fd, "staff_id");
  const role = text(fd, "role") === "secondary" ? "secondary" : "primary";
  const started_on = text(fd, "started_on") ?? new Date().toISOString().slice(0, 10);
  if (!customer_id || !staff_id) return { error: "엔지니어를 선택하세요." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("engineer_assignments")
    .select("id, staff_id, role")
    .eq("customer_id", customer_id)
    .is("ended_on", null);
  if (current?.some((a) => a.staff_id === staff_id && a.role === role)) {
    return { error: "이미 같은 역할로 배정되어 있습니다." };
  }
  // 정 담당을 바꾸면 기존 정 담당은 시작일 기준으로 종료 처리해 이력으로 남긴다.
  if (role === "primary") {
    const prev = current?.find((a) => a.role === "primary");
    if (prev) {
      const { error } = await supabase
        .from("engineer_assignments")
        .update({ ended_on: started_on, note: text(fd, "note") })
        .eq("id", prev.id);
      const err = fail(error, "기존 담당 종료");
      if (err) return err;
    }
  }
  const { error } = await supabase
    .from("engineer_assignments")
    .insert({ customer_id, staff_id, role, started_on, note: text(fd, "note") });
  const err = fail(error, "배정");
  if (err) return err;
  refresh();
  return { ok: "배정했습니다." };
}

export async function endAssignment(fd: FormData) {
  const user = await requireStaff();
  if (user.role !== "admin") return;
  const supabase = await createClient();
  await supabase
    .from("engineer_assignments")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("id", String(fd.get("id")));
  refresh();
}

// ── 접속정보 ───────────────────────────────────────────────────────
export async function saveCredential(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const customer_id = text(fd, "customer_id");
  const label = text(fd, "label");
  if (!customer_id || !label) return { error: "구분(예: 서버 SSH)을 입력하세요." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_credentials").insert({
    customer_id,
    label,
    system_id: text(fd, "system_id"),
    username_enc: encrypt(text(fd, "username")),
    password_enc: encrypt(text(fd, "password")),
    note: text(fd, "note"),
    created_by: user.id,
  });
  const err = fail(error, "접속정보 저장");
  if (err) return err;
  refresh();
  return { ok: "암호화해서 저장했습니다." };
}

export async function deleteCredential(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("customer_credentials").delete().eq("id", String(fd.get("id")));
  refresh();
}

export type RevealResult = { values?: Record<string, string | null>; error?: string };

// 관리자 또는 현재 담당 엔지니어만 복호화한다. 열람할 때마다 기록을 남긴다.
export async function revealSecret(type: "credential" | "system_ip", id: string): Promise<RevealResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "engineer") return { error: "권한이 없습니다." };

  const admin = createAdminClient();
  const row =
    type === "credential"
      ? (await admin.from("customer_credentials").select("customer_id, username_enc, password_enc").eq("id", id).single()).data
      : (await admin.from("customer_systems").select("customer_id, ip_enc").eq("id", id).single()).data;
  if (!row) return { error: "항목을 찾을 수 없습니다." };

  if (user.role !== "admin") {
    const supabase = await createClient();
    const { data: assigned } = await supabase.rpc("is_assigned_engineer", { p_customer_id: row.customer_id });
    if (!assigned) return { error: "이 고객사의 담당 엔지니어와 관리자만 볼 수 있습니다." };
  }

  await admin.from("secret_access_logs").insert({
    user_id: user.id,
    customer_id: row.customer_id,
    target_type: type,
    target_id: id,
  });

  try {
    return "ip_enc" in row
      ? { values: { ip: decrypt(row.ip_enc) } }
      : { values: { username: decrypt(row.username_enc), password: decrypt(row.password_enc) } };
  } catch {
    return { error: "복호화에 실패했습니다. 암호화 키(ENCRYPTION_KEY)를 확인하세요." };
  }
}
