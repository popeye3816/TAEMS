"use client";

import { todayKst } from "@/lib/format";
import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { ActionForm, Field } from "@/components/action-form";
import { EDITIONS, ENVIRONMENTS, PRODUCTS } from "@/lib/customer-fields";
import { assignEngineer, saveContact, saveCredential, saveSystem } from "../actions";
import { savePlan } from "../../schedule/actions";
import { ALL_MONTHS, CYCLE_LABELS, CYCLES, DEFAULT_MONTHS, METHODS, type Cycle } from "@/lib/inspection-cycle";

// 펼침/접힘 패널. 추가·수정 폼을 평소에는 숨겨 둔다.
function Toggle({
  label,
  children,
  variant = "add",
}: {
  label: string;
  children: (close: () => void) => ReactNode;
  variant?: "add" | "edit";
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return variant === "add" ? (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <Plus className="size-4" aria-hidden />
        {label}
      </button>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-blue-700 hover:underline">
        {label}
      </button>
    );
  }
  return (
    <div className="card w-full border-blue-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">
          닫기
        </button>
      </div>
      {children(() => setOpen(false))}
    </div>
  );
}

type System = {
  id: string;
  business_name: string | null;
  environment: string | null;
  hostname: string | null;
  has_ip: boolean;
  os: string | null;
  product: string;
  version: string | null;
  edition: string | null;
  license_count: number | null;
  cpu: string | null;
  memory: string | null;
  java_version: string | null;
  install_path: string | null;
  log_path: string | null;
  dump_path: string | null;
  note: string | null;
};

function SystemForm({ customerId, system, onDone }: { customerId: string; system?: System; onDone?: () => void }) {
  const s = system;
  return (
    <ActionForm action={saveSystem} resetOnSuccess={!s} onSuccess={onDone}>
      <input type="hidden" name="customer_id" value={customerId} />
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="제품 *">
          <select name="product" required defaultValue={s?.product ?? "WAS"} className="input">
            {PRODUCTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="업무명">
          <input name="business_name" defaultValue={s?.business_name ?? ""} className="input" />
        </Field>
        <Field label="환경">
          <select name="environment" defaultValue={s?.environment ?? ""} className="input">
            <option value="">미지정</option>
            {ENVIRONMENTS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </Field>
        <Field label="호스트명">
          <input name="hostname" defaultValue={s?.hostname ?? ""} className="input" />
        </Field>
        <Field label={s?.has_ip ? "IP:Port (비우면 기존 값 유지)" : "IP:Port (암호화 저장)"}>
          <input name="ip" autoComplete="off" className="input" />
          {s?.has_ip && (
            <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" name="ip_clear" /> IP 삭제
            </span>
          )}
        </Field>
        <Field label="OS">
          <input name="os" defaultValue={s?.os ?? ""} className="input" />
        </Field>
        <Field label="버전·Fix Level">
          <input name="version" defaultValue={s?.version ?? ""} className="input" />
        </Field>
        <Field label="에디션">
          <input name="edition" list="editions" defaultValue={s?.edition ?? ""} className="input" />
          <datalist id="editions">
            {EDITIONS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </Field>
        <Field label="라이선스 수량">
          <input name="license_count" inputMode="numeric" defaultValue={s?.license_count ?? ""} className="input" />
        </Field>
        <Field label="CPU">
          <input name="cpu" defaultValue={s?.cpu ?? ""} className="input" />
        </Field>
        <Field label="메모리">
          <input name="memory" defaultValue={s?.memory ?? ""} className="input" />
        </Field>
        <Field label="JAVA 버전">
          <input name="java_version" defaultValue={s?.java_version ?? ""} className="input" />
        </Field>
        <Field label="설치 경로" className="sm:col-span-2">
          <input name="install_path" defaultValue={s?.install_path ?? ""} className="input" />
        </Field>
        <Field label="로그 경로">
          <input name="log_path" defaultValue={s?.log_path ?? ""} className="input" />
        </Field>
        <Field label="덤프 경로">
          <input name="dump_path" defaultValue={s?.dump_path ?? ""} className="input" />
        </Field>
        <Field label="메모" className="sm:col-span-2 lg:col-span-4">
          <input name="note" defaultValue={s?.note ?? ""} className="input" />
        </Field>
      </div>
    </ActionForm>
  );
}

type Contact = {
  id: string;
  name: string;
  title: string | null;
  organization: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  is_active: boolean;
  note: string | null;
};

function ContactForm({ customerId, contact, onDone }: { customerId: string; contact?: Contact; onDone?: () => void }) {
  const p = contact;
  return (
    <ActionForm action={saveContact} resetOnSuccess={!p} onSuccess={onDone}>
      <input type="hidden" name="customer_id" value={customerId} />
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="이름 *">
          <input name="name" required defaultValue={p?.name} className="input" />
        </Field>
        <Field label="직급">
          <input name="title" defaultValue={p?.title ?? ""} className="input" />
        </Field>
        <Field label="소속 (중간업체 포함)">
          <input name="organization" defaultValue={p?.organization ?? ""} className="input" />
        </Field>
        <Field label="전화">
          <input name="phone" type="tel" defaultValue={p?.phone ?? ""} className="input" />
        </Field>
        <Field label="이메일">
          <input name="email" type="email" defaultValue={p?.email ?? ""} className="input" />
        </Field>
        <Field label="메모">
          <input name="note" defaultValue={p?.note ?? ""} className="input" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="is_primary" defaultChecked={p?.is_primary} /> 주 담당자
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="is_active" value="off" defaultChecked={p ? !p.is_active : false} /> 이전
          담당자로 표시 (담당 변경 시)
        </label>
      </div>
    </ActionForm>
  );
}

function AssignForm({
  customerId,
  engineers,
}: {
  customerId: string;
  engineers: { id: string; name: string }[];
}) {
  const today = todayKst();
  return (
    <ActionForm action={assignEngineer} submitLabel="배정">
      <input type="hidden" name="customer_id" value={customerId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="엔지니어 *">
          <select name="staff_id" required defaultValue="" className="input">
            <option value="" disabled>
              선택
            </option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="역할">
          <select name="role" defaultValue="primary" className="input">
            <option value="primary">정 담당 (기존 정 담당은 이력으로)</option>
            <option value="secondary">부 담당</option>
          </select>
        </Field>
        <Field label="시작일">
          <input name="started_on" type="date" defaultValue={today} className="input" />
        </Field>
        <Field label="메모 (인수인계 사유 등)">
          <input name="note" className="input" />
        </Field>
      </div>
    </ActionForm>
  );
}

function CredentialForm({
  customerId,
  systems,
}: {
  customerId: string;
  systems: { id: string; label: string }[];
}) {
  return (
    <ActionForm action={saveCredential} resetOnSuccess>
      <input type="hidden" name="customer_id" value={customerId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="구분 * (예: WAS 관리콘솔, 서버 SSH)">
          <input name="label" required className="input" />
        </Field>
        <Field label="관련 시스템">
          <select name="system_id" defaultValue="" className="input">
            <option value="">선택 안 함</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="메모 (접속 경로 등, 암호화 안 됨)">
          <input name="note" className="input" />
        </Field>
        <Field label="계정">
          <input name="username" autoComplete="off" className="input" />
        </Field>
        <Field label="비밀번호">
          <input name="password" type="password" autoComplete="new-password" className="input" />
        </Field>
      </div>
      <p className="text-xs text-slate-500">계정과 비밀번호는 암호화해서 저장합니다.</p>
    </ActionForm>
  );
}

// ── 서버 컴포넌트에서 바로 쓰는 추가·수정 버튼 ─────────────────────
export function AddSystem({ customerId }: { customerId: string }) {
  return <Toggle label="시스템 추가">{(close) => <SystemForm customerId={customerId} onDone={close} />}</Toggle>;
}
export function EditSystem({ customerId, system }: { customerId: string; system: System }) {
  return (
    <Toggle label="수정" variant="edit">
      {(close) => <SystemForm customerId={customerId} system={system} onDone={close} />}
    </Toggle>
  );
}
export function AddContact({ customerId }: { customerId: string }) {
  return <Toggle label="담당자 추가">{(close) => <ContactForm customerId={customerId} onDone={close} />}</Toggle>;
}
export function EditContact({ customerId, contact }: { customerId: string; contact: Contact }) {
  return (
    <Toggle label="수정" variant="edit">
      {(close) => <ContactForm customerId={customerId} contact={contact} onDone={close} />}
    </Toggle>
  );
}
export function AddAssignment(props: { customerId: string; engineers: { id: string; name: string }[] }) {
  return <Toggle label="엔지니어 배정">{() => <AssignForm {...props} />}</Toggle>;
}
export function AddCredential(props: { customerId: string; systems: { id: string; label: string }[] }) {
  return <Toggle label="접속정보 추가">{() => <CredentialForm {...props} />}</Toggle>;
}

// ── 점검 주기 ──────────────────────────────────────────────────────
type Plan = {
  id: string;
  cycle: string;
  months: number[];
  method: string;
  visit_months: number[];
  preferred_timing: string | null;
  products: string[];
  is_active: boolean;
};

function PlanForm({
  customerId,
  products,
  plan,
  onDone,
}: {
  customerId: string;
  products: string[];
  plan?: Plan;
  onDone?: () => void;
}) {
  const [cycle, setCycle] = useState<Cycle>((plan?.cycle as Cycle) ?? "monthly");
  const [method, setMethod] = useState(plan?.method ?? "방문");
  const [months, setMonths] = useState<number[]>(plan?.months.length ? plan.months : DEFAULT_MONTHS.monthly);
  const showMonths = cycle !== "monthly" && cycle !== "percall";

  return (
    <ActionForm action={savePlan} onSuccess={onDone}>
      <input type="hidden" name="customer_id" value={customerId} />
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="주기">
          <select
            name="cycle"
            value={cycle}
            onChange={(e) => {
              const c = e.target.value as Cycle;
              setCycle(c);
              setMonths(DEFAULT_MONTHS[c]);
            }}
            className="input"
          >
            {CYCLES.map((c) => (
              <option key={c} value={c}>
                {CYCLE_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="방식">
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className="input">
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m === "혼합" ? "혼합 (원격 + 일부 달 방문)" : m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="선호 시기 (예: 월 하순, 20일 전)">
          <input name="preferred_timing" defaultValue={plan?.preferred_timing ?? ""} className="input" />
        </Field>
      </div>
      {showMonths && (
        <MonthPicker name="months" label="점검하는 달" selected={months} onChange={setMonths} />
      )}
      {method === "혼합" && cycle !== "percall" && (
        <MonthPicker
          name="visit_months"
          label="방문하는 달 (나머지 달은 원격)"
          options={cycle === "monthly" ? ALL_MONTHS : months}
          defaultSelected={plan?.visit_months ?? [3, 6, 9, 12]}
        />
      )}
      {products.length > 1 && (
        <fieldset className="space-y-1 text-sm">
          <legend className="text-slate-600">점검 제품 (선택 안 하면 고객사 제품 전체)</legend>
          <div className="flex flex-wrap gap-x-4">
            {products.map((p) => (
              <label key={p} className="flex items-center gap-1.5">
                <input type="checkbox" name="products" value={p} defaultChecked={plan?.products.includes(p)} /> {p}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {plan && (
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="is_active" value="off" defaultChecked={!plan.is_active} /> 사용 중지 (일정을 만들지 않음)
        </label>
      )}
    </ActionForm>
  );
}

function MonthPicker({
  name,
  label,
  selected,
  onChange,
  options = ALL_MONTHS,
  defaultSelected,
}: {
  name: string;
  label: string;
  selected?: number[];
  onChange?: (m: number[]) => void;
  options?: number[];
  defaultSelected?: number[];
}) {
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="text-slate-600">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((m) => (
          <label key={m} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1">
            <input
              type="checkbox"
              name={name}
              value={m}
              {...(selected
                ? {
                    checked: selected.includes(m),
                    onChange: (e) =>
                      onChange?.(e.target.checked ? [...selected, m].sort((a, b) => a - b) : selected.filter((x) => x !== m)),
                  }
                : { defaultChecked: defaultSelected?.includes(m) })}
            />
            {m}월
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AddPlan({ customerId, products }: { customerId: string; products: string[] }) {
  return (
    <Toggle label="점검 주기 추가">{(close) => <PlanForm customerId={customerId} products={products} onDone={close} />}</Toggle>
  );
}
export function EditPlan({ customerId, products, plan }: { customerId: string; products: string[]; plan: Plan }) {
  return (
    <Toggle label="수정" variant="edit">
      {(close) => <PlanForm customerId={customerId} products={products} plan={plan} onDone={close} />}
    </Toggle>
  );
}
