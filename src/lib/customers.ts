import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CustomerFilters = {
  q?: string;
  product?: string;
  engineer?: string; // staff id
  team?: string;
  status?: string;
};

export async function listCustomers(f: CustomerFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select(
      `id, name, group_name, status, business_unit, importance, remote_access, support_level,
       products, inspection_cycle_note,
       sales_rep:staff!customers_sales_rep_id_fkey(name),
       assignments:engineer_assignments(role, ended_on, staff(id, name))`,
    )
    .order("name");

  if (f.q) query = query.or(`name.ilike.%${escapeLike(f.q)}%,group_name.ilike.%${escapeLike(f.q)}%`);
  if (f.product) query = query.contains("products", [f.product]);
  if (f.team) query = query.eq("business_unit", f.team);
  query = query.eq("status", f.status === "ended" ? "ended" : "active");

  const { data, error } = await query;
  if (error) throw new Error(`고객사 목록 조회 실패: ${error.message}`);

  const rows = data.map((c) => {
    const current = c.assignments.filter((a) => a.ended_on === null);
    return {
      ...c,
      primary: current.find((a) => a.role === "primary")?.staff ?? null,
      secondary: current.filter((a) => a.role === "secondary").map((a) => a.staff),
    };
  });
  return f.engineer
    ? rows.filter((c) => c.primary?.id === f.engineer || c.secondary.some((s) => s.id === f.engineer))
    : rows;
}

// PostgREST or() 필터 안에서 쓰는 값의 특수문자 제거
function escapeLike(v: string) {
  return v.replace(/[%_,()\\]/g, " ").trim();
}

export async function getCustomer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      `*,
       sales_rep:staff!customers_sales_rep_id_fkey(id, name),
       contacts:customer_contacts(*),
       systems:customer_systems(id, business_name, environment, hostname, ip_enc, os, product, version, edition,
         license_count, cpu, memory, java_version, install_path, log_path, dump_path, note, source),
       contracts(*),
       assignments:engineer_assignments(*, staff(id, name, profile_id)),
       credentials:customer_credentials(id, label, note, system_id, username_enc, updated_at)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`고객사 조회 실패: ${error.message}`);
  if (!data) return null;

  // 암호문은 화면에 내려보내지 않고, 값이 있는지만 알려준다.
  return {
    ...data,
    systems: data.systems
      .map(({ ip_enc, ...s }) => ({ ...s, has_ip: Boolean(ip_enc) }))
      .sort((a, b) => (a.business_name ?? "").localeCompare(b.business_name ?? "", "ko")),
    credentials: data.credentials.map(({ username_enc, ...c }) => ({ ...c, has_username: Boolean(username_enc) })),
    contacts: data.contacts.sort(
      (a, b) => Number(b.is_active) - Number(a.is_active) || Number(b.is_primary) - Number(a.is_primary),
    ),
    contracts: data.contracts.sort((a, b) => (b.end_date ?? "").localeCompare(a.end_date ?? "")),
    assignments: data.assignments.sort((a, b) => b.started_on.localeCompare(a.started_on)),
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

export async function listStaff(kind?: "engineer" | "sales") {
  const supabase = await createClient();
  let query = supabase.from("staff").select("id, name, kind, profile_id").eq("is_active", true).order("name");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw new Error(`직원 조회 실패: ${error.message}`);
  return data;
}

export async function listBusinessUnits() {
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("business_unit").not("business_unit", "is", null);
  return [...new Set((data ?? []).map((r) => r.business_unit as string))].sort((a, b) => a.localeCompare(b, "ko"));
}
