"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ALL_MONTHS, CYCLES, METHODS, type Cycle } from "@/lib/inspection-cycle";
import { INSPECTION_STATUSES, type InspectionStatus } from "@/lib/inspection-fields";
import type { TablesUpdate } from "@/lib/database.types";

export type FormState = { ok?: string; error?: string } | undefined;

const requireStaff = () => requireRole(pathRoles("/schedule"));

function text(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}
function fail(e: { message: string } | null, what: string): FormState {
  if (!e) return undefined;
  if (/row-level security|permission/i.test(e.message)) return { error: `${what}: 권한이 없습니다.` };
  return { error: `${what} 실패: ${e.message}` };
}
function months(fd: FormData, key: string) {
  return [...new Set(fd.getAll(key).map(Number))].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
}

// ── 점검 주기 ──────────────────────────────────────────────────────
export async function savePlan(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = text(fd, "id");
  const customer_id = text(fd, "customer_id");
  const cycle = text(fd, "cycle") as Cycle | null;
  const method = text(fd, "method");
  if (!customer_id || !cycle || !(CYCLES as readonly string[]).includes(cycle)) return { error: "주기를 선택하세요." };
  if (!method || !(METHODS as readonly string[]).includes(method)) return { error: "방식을 선택하세요." };

  const m = cycle === "monthly" ? ALL_MONTHS : cycle === "percall" ? [] : months(fd, "months");
  if (cycle !== "percall" && m.length === 0) return { error: "점검하는 달을 하나 이상 선택하세요." };
  const visit = method === "혼합" ? months(fd, "visit_months").filter((v) => m.includes(v)) : [];
  if (method === "혼합" && visit.length === 0) return { error: "혼합 방식이면 방문하는 달을 선택하세요." };

  const row = {
    customer_id,
    cycle,
    months: m,
    method: method as (typeof METHODS)[number],
    visit_months: visit,
    preferred_timing: text(fd, "preferred_timing"),
    products: fd.getAll("products").map(String),
    is_active: fd.get("is_active") !== "off",
    needs_review: false,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("inspection_plans").update(row).eq("id", id)
    : await supabase.from("inspection_plans").insert(row);
  const err = fail(error, "점검 주기 저장");
  if (err) return err;
  refresh();
  return { ok: "저장했습니다." };
}

export async function deletePlan(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("inspection_plans").delete().eq("id", String(fd.get("id")));
  refresh();
}

// ── 월 일정 생성 (관리자) ──────────────────────────────────────────
export async function generateMonth(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  if (user.role !== "admin") return { error: "일정 생성은 관리자만 할 수 있습니다." };
  const year = Number(fd.get("year"));
  const month = Number(fd.get("month"));

  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("inspection_plans")
    .select(
      `id, method, visit_months, products,
       customer:customers!inner(id, status, products,
         assignments:engineer_assignments(staff_id, role, ended_on))`,
    )
    .eq("is_active", true)
    .neq("cycle", "percall")
    .contains("months", [month])
    .eq("customer.status", "active");
  if (error) return fail(error, "점검 주기 조회");

  const { data: existing } = await supabase
    .from("inspections")
    .select("plan_id")
    .eq("year", year)
    .eq("month", month)
    .not("plan_id", "is", null);
  const done = new Set((existing ?? []).map((e) => e.plan_id));

  const rows = plans
    .filter((p) => !done.has(p.id))
    .map((p) => {
      const primary = p.customer.assignments.find((a) => a.role === "primary" && a.ended_on === null);
      return {
        customer_id: p.customer.id,
        plan_id: p.id,
        year,
        month,
        status: "planned" as const,
        engineer_id: primary?.staff_id ?? null,
        method: (p.method === "혼합" ? (p.visit_months.includes(month) ? "방문" : "원격") : p.method) as "방문" | "원격",
        products: p.products.length ? p.products : p.customer.products,
        updated_by: user.id,
      };
    });
  if (rows.length === 0) return { ok: "새로 만들 점검이 없습니다. 이미 모두 생성되었습니다." };
  const { error: insErr } = await supabase.from("inspections").insert(rows);
  const err = fail(insErr, "일정 생성");
  if (err) return err;
  refresh();
  const unassigned = rows.filter((r) => !r.engineer_id).length;
  return { ok: `${rows.length}건을 만들었습니다.${unassigned ? ` 담당 엔지니어가 없는 ${unassigned}건은 배정해 주세요.` : ""}` };
}

// 퍼콜 지원·추가 점검처럼 주기와 무관한 점검 등록
export async function addInspection(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const customer_id = text(fd, "customer_id");
  const date = text(fd, "scheduled_date");
  if (!customer_id || !date) return { error: "고객사와 날짜를 입력하세요." };
  const d = new Date(date);
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("products, assignments:engineer_assignments(staff_id, role, ended_on)")
    .eq("id", customer_id)
    .single();
  const primary = customer?.assignments.find((a) => a.role === "primary" && a.ended_on === null);
  const { error } = await supabase.from("inspections").insert({
    customer_id,
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    scheduled_date: date,
    status: "scheduled",
    method: text(fd, "method") === "원격" ? "원격" : "방문",
    engineer_id: text(fd, "engineer_id") ?? primary?.staff_id ?? null,
    products: customer?.products ?? [],
    summary: text(fd, "summary"),
    updated_by: user.id,
  });
  const err = fail(error, "점검 추가");
  if (err) return err;
  refresh();
  return { ok: "추가했습니다." };
}

// 일정 표에서 날짜·상태·방식·담당 변경 (담당 변경은 관리자만)
export async function updateSchedule(fd: FormData) {
  const user = await requireStaff();
  const id = String(fd.get("id"));
  const status = text(fd, "status");
  const date = text(fd, "scheduled_date");
  const patch: TablesUpdate<"inspections"> = { scheduled_date: date, updated_by: user.id };
  if (status && (INSPECTION_STATUSES as readonly string[]).includes(status)) patch.status = status as InspectionStatus;
  else if (date) patch.status = "scheduled";
  const method = text(fd, "method");
  if (method === "방문" || method === "원격") patch.method = method;
  if (user.role === "admin" && fd.has("engineer_id")) patch.engineer_id = text(fd, "engineer_id");
  if (patch.status === "planned" && date) patch.status = "scheduled";

  const supabase = await createClient();
  await supabase.from("inspections").update(patch).eq("id", id);
  refresh();
}

// ── 파일 업로드 (브라우저 → Supabase Storage 직접) ─────────────────
const BUCKETS = { report: "inspection-reports", template: "report-templates" } as const;

function ext(fileName: string) {
  const m = fileName.match(/\.([A-Za-z0-9]{1,8})$/);
  return m ? `.${m[1].toLowerCase()}` : "";
}

export async function prepareUpload(
  kind: "report" | "template",
  ownerId: string,
  fileName: string,
): Promise<{ path?: string; token?: string; error?: string }> {
  const user = await requireStaff();
  if (kind === "template" && user.role !== "admin") return { error: "양식은 관리자만 올릴 수 있습니다." };
  // 저장 경로에는 한글 등 특수문자를 쓰지 않는다. 원래 파일명은 DB에 따로 보관한다.
  const path = `${ownerId}/${new Date().toISOString().slice(0, 10)}-${randomUUID()}${ext(fileName)}`;
  const { data, error } = await createAdminClient().storage.from(BUCKETS[kind]).createSignedUploadUrl(path);
  if (error || !data) return { error: `업로드 준비 실패: ${error?.message}` };
  return { path: data.path, token: data.token };
}

export async function confirmReportUpload(input: {
  inspectionId: string;
  path: string;
  fileName: string;
  fileSize: number;
  contentType: string | null;
  product: string | null;
  signed: boolean;
}): Promise<FormState> {
  const user = await requireStaff();
  const supabase = await createClient();
  const { data: insp } = await supabase
    .from("inspections")
    .select("id, customer_id, status, reports:inspection_reports(id)")
    .eq("id", input.inspectionId)
    .single();
  if (!insp) return { error: "점검을 찾을 수 없습니다." };
  if (!input.path.startsWith(`${insp.id}/`)) return { error: "잘못된 업로드 경로입니다." };

  const { error } = await supabase.from("inspection_reports").insert({
    inspection_id: insp.id,
    customer_id: insp.customer_id,
    product: input.product,
    storage_path: input.path,
    file_name: input.fileName,
    file_size: input.fileSize,
    content_type: input.contentType,
    version: insp.reports.length + 1,
    customer_signed: input.signed,
    uploaded_by: user.id,
  });
  const err = fail(error, "결과서 등록");
  if (err) return err;
  if (insp.status !== "canceled") {
    await supabase
      .from("inspections")
      .update({ status: "reported", reported_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", insp.id);
  }
  // 영업 담당 알림(메일·메신저)은 M6에서 이 지점에 연결한다.
  refresh();
  return { ok: "결과서를 올렸습니다. 영업 담당자가 점검결과서 화면에서 내려받을 수 있습니다." };
}

export async function toggleSigned(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await supabase
    .from("inspection_reports")
    .update({ customer_signed: fd.get("signed") === "true" })
    .eq("id", String(fd.get("id")));
  refresh();
}

export async function deleteReport(fd: FormData) {
  const user = await requireStaff();
  if (user.role !== "admin") return;
  const supabase = await createClient();
  const { data } = await supabase.from("inspection_reports").select("storage_path").eq("id", String(fd.get("id"))).single();
  if (data) await createAdminClient().storage.from(BUCKETS.report).remove([data.storage_path]);
  await supabase.from("inspection_reports").delete().eq("id", String(fd.get("id")));
  refresh();
}

export async function confirmTemplateUpload(input: {
  path: string;
  fileName: string;
  name: string;
  product: string | null;
  customerId: string | null;
}): Promise<FormState> {
  const user = await requireStaff();
  if (user.role !== "admin") return { error: "양식은 관리자만 올릴 수 있습니다." };
  const supabase = await createClient();
  // 같은 이름·제품·고객사의 이전 양식은 내리고 버전을 올린다.
  let prevQuery = supabase.from("report_templates").select("id, version").eq("name", input.name).eq("is_active", true);
  prevQuery = input.product ? prevQuery.eq("product", input.product) : prevQuery.is("product", null);
  prevQuery = input.customerId ? prevQuery.eq("customer_id", input.customerId) : prevQuery.is("customer_id", null);
  const { data: prev } = await prevQuery;
  const version = Math.max(0, ...(prev ?? []).map((p) => p.version)) + 1;
  if (prev?.length) {
    await supabase.from("report_templates").update({ is_active: false }).in("id", prev.map((p) => p.id));
  }
  const { error } = await supabase.from("report_templates").insert({
    name: input.name,
    product: input.product,
    customer_id: input.customerId,
    storage_path: input.path,
    file_name: input.fileName,
    version,
    uploaded_by: user.id,
  });
  const err = fail(error, "양식 등록");
  if (err) return err;
  refresh();
  return { ok: `양식을 등록했습니다 (v${version}).` };
}

export async function deactivateTemplate(fd: FormData) {
  const user = await requireStaff();
  if (user.role !== "admin") return;
  const supabase = await createClient();
  await supabase.from("report_templates").update({ is_active: false }).eq("id", String(fd.get("id")));
  refresh();
}
