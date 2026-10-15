import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listMonthInspections(year: number, month: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      `id, status, scheduled_date, method, products, customer_id,
       customer:customers(id, name, address),
       engineer:staff(id, name),
       reports:inspection_reports(id)`,
    )
    .eq("year", year)
    .eq("month", month);
  if (error) throw new Error(`점검 조회 실패: ${error.message}`);
  return data.sort(
    (a, b) =>
      (a.scheduled_date ?? "9999").localeCompare(b.scheduled_date ?? "9999") ||
      a.customer.name.localeCompare(b.customer.name, "ko"),
  );
}

// 해당 월에 점검해야 하는데 아직 만들지 않은 주기 수
export async function countPendingPlans(year: number, month: number) {
  const supabase = await createClient();
  const [{ data: plans }, { data: existing }] = await Promise.all([
    supabase
      .from("inspection_plans")
      .select("id, customer:customers!inner(status)")
      .eq("is_active", true)
      .neq("cycle", "percall")
      .contains("months", [month])
      .eq("customer.status", "active"),
    supabase.from("inspections").select("plan_id").eq("year", year).eq("month", month).not("plan_id", "is", null),
  ]);
  const done = new Set((existing ?? []).map((e) => e.plan_id));
  return (plans ?? []).filter((p) => !done.has(p.id)).length;
}

export async function getInspection(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      `*,
       customer:customers(id, name, products, address, visit_procedure, inspection_method,
         systems:customer_systems(id, business_name, hostname, product, version, edition, environment)),
       engineer:staff(id, name),
       plan:inspection_plans(cycle, months, method, visit_months, preferred_timing),
       results:inspection_results(item_id, target_key, result, detail),
       reports:inspection_reports(id, file_name, file_size, product, version, customer_signed, created_at,
         uploader:profiles(name))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`점검 조회 실패: ${error.message}`);
  if (!data) return null;
  return { ...data, reports: data.reports.sort((a, b) => b.created_at.localeCompare(a.created_at)) };
}
export type InspectionDetail = NonNullable<Awaited<ReturnType<typeof getInspection>>>;

export async function listChecklists(products: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .select("id, product, title, result_scale, items:checklist_items(id, section, name, method, sort_order, is_active)")
    .in("product", products.length ? products : ["-"]);
  if (error) throw new Error(`점검 항목 조회 실패: ${error.message}`);
  return data.map((t) => ({
    ...t,
    items: t.items.filter((i) => i.is_active).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function listReportTemplates(customerId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("report_templates")
    .select("id, name, product, customer_id, file_name, version, created_at, customer:customers(name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (customerId) query = query.or(`customer_id.is.null,customer_id.eq.${customerId}`);
  const { data, error } = await query;
  if (error) throw new Error(`결과서 양식 조회 실패: ${error.message}`);
  return data;
}

export async function listCustomerInspections(customerId: string) {
  const supabase = await createClient();
  const [{ data: plans }, { data: inspections }] = await Promise.all([
    supabase.from("inspection_plans").select("*").eq("customer_id", customerId).order("created_at"),
    supabase
      .from("inspections")
      .select("id, year, month, status, scheduled_date, method, engineer:staff(name), reports:inspection_reports(id)")
      .eq("customer_id", customerId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(36),
  ]);
  return { plans: plans ?? [], inspections: inspections ?? [] };
}
