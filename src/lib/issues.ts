import "server-only";
import { createClient } from "@/lib/supabase/server";

export type IssueFilters = {
  q?: string;
  status?: string; // 'open'(기본) | 'all' | 개별 상태
  customer?: string;
  assignee?: string; // staff id 또는 'none'
  severity?: string;
};

const LIST_SELECT = `id, number, title, status, severity, channel, received_at, resolved_at,
  customer:customers(id, name), assignee:staff(id, name)`;

export async function listIssues(f: IssueFilters) {
  const supabase = await createClient();
  let query = supabase.from("issues").select(LIST_SELECT).order("received_at", { ascending: false }).limit(300);
  if (!f.status || f.status === "open") query = query.neq("status", "resolved");
  else if (f.status !== "all") query = query.eq("status", f.status);
  if (f.customer) query = query.eq("customer_id", f.customer);
  if (f.assignee === "none") query = query.is("assignee_id", null);
  else if (f.assignee) query = query.eq("assignee_id", f.assignee);
  if (f.severity) query = query.eq("severity", f.severity);
  if (f.q) {
    const q = f.q.replace(/[%_,()\\]/g, " ").trim();
    const num = Number(q.replace(/^#/, ""));
    query = Number.isInteger(num) && num > 0 ? query.eq("number", num) : query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`이슈 조회 실패: ${error.message}`);
  return data;
}
export type IssueRow = Awaited<ReturnType<typeof listIssues>>[number];

export async function getIssue(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("issues")
    .select(
      `*,
       customer:customers(id, name),
       system:customer_systems(id, business_name, hostname, product, version),
       inspection:inspections(id, year, month),
       assignee:staff(id, name, profile_id),
       reporter:profiles(name),
       activities:issue_activities(id, kind, body, created_at, author:profiles(id, name)),
       files:issue_files(id, file_name, file_size, content_type, created_at, uploaded_by, uploader:profiles(name)),
       kb:kb_articles(id, number, status)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`이슈 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    ...data,
    activities: data.activities.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    files: data.files.sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}
export type IssueDetail = NonNullable<Awaited<ReturnType<typeof getIssue>>>;

// 같은 고객사의 다른 이슈 (최근 순)
export async function listCustomerIssues(customerId: string, excludeId?: string, limit = 50) {
  const supabase = await createClient();
  let query = supabase
    .from("issues")
    .select(`${LIST_SELECT}, cause, action`)
    .eq("customer_id", customerId)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return data ?? [];
}

export async function listCustomerOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, systems:customer_systems(id, business_name, hostname, product)")
    .eq("status", "active")
    .order("name");
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    systems: c.systems.map((s) => ({ id: s.id, label: [s.product, s.business_name, s.hostname].filter(Boolean).join(" · ") })),
  }));
}
