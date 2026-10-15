import { todayKst } from "@/lib/format";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { getCustomer, listStaff, type CustomerDetail } from "@/lib/customers";
import {
  ASSIGNMENT_ROLE_LABELS,
  CUSTOMER_TABS,
  NARRATIVE_FIELDS,
  STATUS_LABELS,
  SUPPORT_LEVEL_HINT,
  formatAmount,
  type CustomerTab,
} from "@/lib/customer-fields";
import { ContentSkeleton } from "@/components/page-header";
import { ConfirmSubmit } from "@/components/action-form";
import { RevealSecret } from "@/components/reveal-secret";
import { deleteContact, deleteCredential, deleteSystem, endAssignment, revealSecret } from "../actions";
import { AddAssignment, AddContact, AddCredential, AddPlan, AddSystem, EditContact, EditPlan, EditSystem } from "./forms";
import { listCustomerInspections } from "@/lib/inspections";
import { describePlan } from "@/lib/inspection-cycle";
import { STATUS_LABEL, STATUS_STYLE, type InspectionStatus } from "@/lib/inspection-fields";
import { deletePlan } from "../../schedule/actions";
import { listCustomerIssues } from "@/lib/issues";
import { formatDateTime } from "@/lib/format";
import { IssueStatusBadge, SeverityBadge } from "@/components/issue-badges";

type Props = PageProps<"/customers/[id]">;

export default function CustomerPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <CustomerView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomerView({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const user = await requireRole(pathRoles("/customers"));
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await getCustomer(id);
  if (!c) notFound();

  const tab = (CUSTOMER_TABS.find((t) => t.key === sp.tab)?.key ?? "overview") as CustomerTab;
  const current = c.assignments.filter((a) => a.ended_on === null);
  const primary = current.find((a) => a.role === "primary");
  const isAdmin = user.role === "admin";
  const canSeeSecrets = isAdmin || current.some((a) => a.staff.profile_id === user.id);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden /> 고객사 목록
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900">
              {c.name}
              {c.status === "ended" && (
                <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {STATUS_LABELS.ended}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {[c.business_unit, c.sales_rep && `영업 ${c.sales_rep.name}`, primary && `정 담당 ${primary.staff.name}`]
                .filter(Boolean)
                .join(" · ") || "영업·담당 미지정"}
            </p>
          </div>
          <Link href={`/customers/${c.id}/edit`} className="btn-secondary">
            <Pencil className="size-4" aria-hidden /> 정보 수정
          </Link>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="고객사 상세 탭">
        {CUSTOMER_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/customers/${c.id}` : `/customers/${c.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={clsx(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key
                ? "border-blue-700 text-blue-800"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
            <TabCount tab={t.key} c={c} />
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview c={c} />}
      {tab === "systems" && <Systems c={c} canSeeSecrets={canSeeSecrets} />}
      {tab === "contacts" && <Contacts c={c} />}
      {tab === "engineers" && <Engineers c={c} isAdmin={isAdmin} />}
      {tab === "contracts" && <Contracts c={c} />}
      {tab === "access" && <Access c={c} canSeeSecrets={canSeeSecrets} />}
      {tab === "history" && <History c={c} />}
    </div>
  );
}

function TabCount({ tab, c }: { tab: CustomerTab; c: CustomerDetail }) {
  const n =
    tab === "systems" ? c.systems.length
    : tab === "contacts" ? c.contacts.filter((p) => p.is_active).length
    : tab === "contracts" ? c.contracts.length
    : tab === "access" ? c.credentials.length
    : null;
  return n ? <span className="ml-1 text-xs text-slate-400">{n}</span> : null;
}

// ── 개요 ───────────────────────────────────────────────────────────
function Overview({ c }: { c: CustomerDetail }) {
  const facts: [string, ReactNode][] = [
    ["제품", c.products.join(", ")],
    ["제품·버전", c.product_versions],
    ["업무 범위", c.business_scope],
    ["점검시기", c.inspection_cycle_note],
    ["지원 횟수", c.support_count_note],
    ["중요도", c.importance],
    ["서비스 난이도", c.service_difficulty],
    ["지원 등급", c.support_level && `${c.support_level} (${SUPPORT_LEVEL_HINT[c.support_level]})`],
    ["원격 지원", c.remote_access],
    ["연간 금액", formatAmount(c.annual_amount)],
    ["고객 그룹", c.group_name],
  ];
  const narratives = NARRATIVE_FIELDS.filter((f) => c[f.key]);
  const missing = NARRATIVE_FIELDS.filter((f) => !c[f.key] && f.key !== "notes");

  return (
    <div className="space-y-5">
      <dl className="card grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-slate-900">{value || <span className="text-slate-300">—</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-4 lg:grid-cols-2">
        {narratives.map((f) => (
          <section key={f.key} className="card p-5">
            <h2 className="text-xs font-semibold text-slate-500">{f.label}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{c[f.key]}</p>
          </section>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          아직 비어 있는 항목: {missing.map((f) => f.label).join(", ")}.{" "}
          <Link href={`/customers/${c.id}/edit`} className="font-medium underline">
            채워 두면
          </Link>{" "}
          담당자가 바뀌어도 인수인계서 없이 이어서 지원할 수 있습니다.
        </p>
      )}
    </div>
  );
}

// ── 시스템 ─────────────────────────────────────────────────────────
function Systems({ c, canSeeSecrets }: { c: CustomerDetail; canSeeSecrets: boolean }) {
  const licenses = c.systems.reduce<Record<string, number>>((acc, s) => {
    if (s.license_count) {
      const key = [s.product, s.edition].filter(Boolean).join(" ");
      acc[key] = (acc[key] ?? 0) + s.license_count;
    }
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          서버 단위로 관리합니다. 결과서의 “점검 대상” 표와 같은 구성입니다.
          {Object.keys(licenses).length > 0 && (
            <> 라이선스: {Object.entries(licenses).map(([k, v]) => `${k} ${v}`).join(", ")}</>
          )}
        </p>
        <AddSystem customerId={c.id} />
      </div>
      {c.systems.length === 0 ? (
        <Empty>등록된 시스템이 없습니다.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">업무 · 환경</th>
                <th className="px-3 py-2.5 font-medium">제품 · 버전</th>
                <th className="px-3 py-2.5 font-medium">호스트 · IP</th>
                <th className="px-3 py-2.5 font-medium">OS · 사양</th>
                <th className="px-3 py-2.5 font-medium">경로</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {c.systems.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-3">
                    <p className="font-medium">{s.business_name ?? "—"}</p>
                    {s.environment && <p className="text-xs text-slate-500">{s.environment}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <p>
                      {s.product} {s.edition}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.version}
                      {s.license_count != null && ` · 라이선스 ${s.license_count}`}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {s.hostname && <p>{s.hostname}</p>}
                    {s.has_ip ? (
                      canSeeSecrets ? (
                        <RevealSecret reveal={revealSecret.bind(null, "system_ip", s.id)} label="IP 보기" />
                      ) : (
                        <span className="text-xs text-slate-400">IP 등록됨 (담당자만 열람)</span>
                      )
                    ) : (
                      !s.hostname && <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {[s.os, s.cpu, s.memory, s.java_version && `JAVA ${s.java_version}`].filter(Boolean).join(" · ") ||
                      "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">
                    {[s.install_path, s.log_path && `log: ${s.log_path}`, s.dump_path && `dump: ${s.dump_path}`]
                      .filter(Boolean)
                      .map((x) => (
                        <p key={x}>{x}</p>
                      ))}
                    {s.note && <p className="font-sans text-slate-500">{s.note}</p>}
                  </td>
                  <td className="space-y-1 px-3 py-3 text-right">
                    <EditSystem customerId={c.id} system={s} />
                    <ConfirmSubmit action={deleteSystem} id={s.id} message={`${s.business_name ?? s.product} 시스템을 삭제할까요?`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 고객 담당자 ────────────────────────────────────────────────────
function Contacts({ c }: { c: CustomerDetail }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddContact customerId={c.id} />
      </div>
      {c.contacts.length === 0 ? (
        <Empty>등록된 고객 담당자가 없습니다.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {c.contacts.map((p) => (
            <li key={p.id} className={clsx("card p-4", !p.is_active && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {p.name} {p.title}
                    {p.is_primary && p.is_active && (
                      <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-800">주 담당</span>
                    )}
                    {!p.is_active && (
                      <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">이전 담당</span>
                    )}
                  </p>
                  {p.organization && <p className="text-xs text-slate-500">{p.organization}</p>}
                </div>
                <div className="flex gap-3">
                  <EditContact customerId={c.id} contact={p} />
                  <ConfirmSubmit action={deleteContact} id={p.id} message={`${p.name} 담당자를 삭제할까요?`} />
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-sm">
                {p.phone && (
                  <p>
                    <a href={`tel:${p.phone}`} className="text-blue-800 hover:underline">
                      {p.phone}
                    </a>
                  </p>
                )}
                {p.email && (
                  <p>
                    <a href={`mailto:${p.email}`} className="text-blue-800 hover:underline">
                      {p.email}
                    </a>
                  </p>
                )}
                {p.note && <p className="text-xs text-slate-500">{p.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 담당 엔지니어 ──────────────────────────────────────────────────
async function Engineers({ c, isAdmin }: { c: CustomerDetail; isAdmin: boolean }) {
  const engineers = isAdmin ? await listStaff("engineer") : [];
  const current = c.assignments.filter((a) => a.ended_on === null);
  const history = c.assignments.filter((a) => a.ended_on !== null);
  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">현재 담당</h2>
          {isAdmin && <AddAssignment customerId={c.id} engineers={engineers} />}
        </div>
        {current.length === 0 ? (
          <p className="mt-3 text-sm text-amber-700">배정된 엔지니어가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {current
              .sort((a, b) => a.role.localeCompare(b.role))
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="mr-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-800">
                      {ASSIGNMENT_ROLE_LABELS[a.role]}
                    </span>
                    <span className="font-medium">{a.staff.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{a.started_on}부터</span>
                    {a.note && <span className="ml-2 text-xs text-slate-500">· {a.note}</span>}
                  </span>
                  {isAdmin && (
                    <ConfirmSubmit
                      action={endAssignment}
                      id={a.id}
                      label="담당 종료"
                      message={`${a.staff.name}의 담당을 오늘 날짜로 종료할까요?`}
                    />
                  )}
                </li>
              ))}
          </ul>
        )}
        {!isAdmin && <p className="mt-3 text-xs text-slate-500">배정 변경은 관리자가 합니다.</p>}
      </section>
      {history.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">이전 담당 이력</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {history.map((a) => (
              <li key={a.id} className="py-2">
                <span className="mr-2 text-xs text-slate-500">{ASSIGNMENT_ROLE_LABELS[a.role]}</span>
                <span className="font-medium">{a.staff.name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {a.started_on} ~ {a.ended_on}
                </span>
                {a.note && <p className="text-xs text-slate-500">{a.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── 계약 ───────────────────────────────────────────────────────────
function Contracts({ c }: { c: CustomerDetail }) {
  if (c.contracts.length === 0) return <Empty>연결된 계약이 없습니다.</Empty>;
  const today = todayKst();
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2.5 font-medium">계약번호 · 내용</th>
            <th className="px-3 py-2.5 font-medium">기간</th>
            <th className="px-3 py-2.5 font-medium">계약처</th>
            <th className="px-3 py-2.5 text-right font-medium">금액</th>
            <th className="px-3 py-2.5 font-medium">청구 메모</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 align-top">
          {c.contracts.map((k) => {
            const expired = k.end_date != null && k.end_date < today;
            return (
              <tr key={k.id} className={clsx(expired && "text-slate-400")}>
                <td className="px-3 py-3">
                  <p className="font-mono text-xs">{k.contract_no}</p>
                  <p>{k.description}</p>
                  {k.auto_renew && <span className="text-xs text-emerald-700">자동연장</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {k.start_date && k.end_date ? `${k.start_date} ~ ${k.end_date}` : k.period_text}
                  {expired && <p className="text-xs">종료됨</p>}
                </td>
                <td className="px-3 py-3">{k.contractor}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{formatAmount(k.amount)}</td>
                <td className="px-3 py-3 text-xs">{k.billing_note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 접속정보 ───────────────────────────────────────────────────────
function Access({ c, canSeeSecrets }: { c: CustomerDetail; canSeeSecrets: boolean }) {
  const systems = c.systems.map((s) => ({ id: s.id, label: [s.business_name, s.product, s.hostname].filter(Boolean).join(" · ") }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          계정·비밀번호는 암호화되어 있고, <strong>관리자와 현재 담당 엔지니어</strong>만 볼 수 있습니다. 열람할 때마다
          기록이 남습니다.
        </p>
        {canSeeSecrets && <AddCredential customerId={c.id} systems={systems} />}
      </div>
      {c.credentials.length === 0 ? (
        <Empty>등록된 접속정보가 없습니다.</Empty>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {c.credentials.map((cr) => (
            <li key={cr.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{cr.label}</p>
                {cr.system_id && (
                  <p className="text-xs text-slate-500">{systems.find((s) => s.id === cr.system_id)?.label}</p>
                )}
                {cr.note && <p className="text-xs text-slate-500">{cr.note}</p>}
              </div>
              <div className="flex items-center gap-4">
                {canSeeSecrets ? (
                  <RevealSecret reveal={revealSecret.bind(null, "credential", cr.id)} />
                ) : (
                  <span className="text-xs text-slate-400">담당자만 열람</span>
                )}
                {canSeeSecrets && (
                  <ConfirmSubmit action={deleteCredential} id={cr.id} message={`${cr.label} 접속정보를 삭제할까요?`} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 점검 주기 · 점검 이력 ─────────────────────────────────────────
async function History({ c }: { c: CustomerDetail }) {
  const [{ plans, inspections }, issues] = await Promise.all([listCustomerInspections(c.id), listCustomerIssues(c.id)]);
  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">점검 주기</h2>
          <AddPlan customerId={c.id} products={c.products} />
        </div>
        {plans.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">점검 주기가 없습니다. 주기를 넣으면 월별 일정에 자동으로 만들어집니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {plans.map((p) => (
              <li key={p.id} className={clsx("space-y-2 py-3", !p.is_active && "text-slate-400")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{describePlan(p)}</span>
                    {p.products.length > 0 && <span className="ml-2 text-xs text-slate-500">{p.products.join(", ")}</span>}
                    {p.preferred_timing && <span className="ml-2 text-xs text-slate-500">· {p.preferred_timing}</span>}
                    {!p.is_active && <span className="ml-2 text-xs">(사용 중지)</span>}
                    {p.needs_review && (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                        자동 생성 · 확인 필요
                      </span>
                    )}
                    {p.source_note && <p className="text-xs text-slate-500">근거: {p.source_note}</p>}
                  </div>
                  <div className="flex gap-3">
                    <ConfirmSubmit action={deletePlan} id={p.id} message="이 점검 주기를 삭제할까요? 이미 만든 점검은 남습니다." />
                  </div>
                </div>
                <EditPlan customerId={c.id} products={c.products} plan={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">점검 이력</h2>
        {inspections.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">아직 점검 기록이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {inspections.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/schedule/${i.id}`} className="text-blue-800 hover:underline">
                  {i.year}년 {i.month}월
                </Link>
                <span className="text-xs text-slate-500">
                  {[i.scheduled_date, i.method, i.engineer?.name].filter(Boolean).join(" · ")}
                </span>
                <span className="flex items-center gap-2">
                  <span className={clsx("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_STYLE[i.status as InspectionStatus])}>
                    {STATUS_LABEL[i.status as InspectionStatus]}
                  </span>
                  <span className="text-xs text-slate-500">결과서 {i.reports.length}건</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">이슈</h2>
          <Link href={`/issues/new?customer=${c.id}`} className="btn-secondary">
            이슈 등록
          </Link>
        </div>
        {issues.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">등록된 이슈가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {issues.map((i) => (
              <li key={i.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <IssueStatusBadge status={i.status} />
                  <SeverityBadge severity={i.severity} />
                  <Link href={`/issues/${i.id}`} className="font-medium text-blue-800 hover:underline">
                    #{i.number} {i.title}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(i.received_at).slice(0, 10)} · {i.assignee?.name ?? "미배정"}
                  </span>
                </div>
                {i.cause && <p className="mt-1 text-xs text-slate-500">원인: {i.cause} / 조치: {i.action}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="card p-8 text-center text-sm text-slate-500">{children}</p>;
}
