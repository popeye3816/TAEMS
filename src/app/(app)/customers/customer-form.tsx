"use client";

import { ActionForm, Field } from "@/components/action-form";
import {
  LEVELS,
  NARRATIVE_FIELDS,
  PRODUCTS,
  REMOTE_ACCESS,
  SUPPORT_LEVEL_HINT,
  SUPPORT_LEVELS,
} from "@/lib/customer-fields";
import { saveCustomer } from "./actions";

type Customer = {
  id: string;
  name: string;
  group_name: string | null;
  status: string;
  business_unit: string | null;
  sales_rep_id: string | null;
  importance: string | null;
  service_difficulty: string | null;
  support_level: string | null;
  remote_access: string | null;
  business_scope: string | null;
  products: string[];
  product_versions: string | null;
  annual_amount: number | null;
  inspection_cycle_note: string | null;
  support_count_note: string | null;
} & Partial<Record<(typeof NARRATIVE_FIELDS)[number]["key"], string | null>>;

export function CustomerForm({
  customer,
  salesReps,
}: {
  customer?: Customer;
  salesReps: { id: string; name: string }[];
}) {
  const c = customer;
  return (
    <ActionForm action={saveCustomer} submitLabel={c ? "저장" : "등록"}>
      {c && <input type="hidden" name="id" value={c.id} />}

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">기본 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="고객사명 *">
            <input name="name" required defaultValue={c?.name} className="input" />
          </Field>
          <Field label="고객 그룹 (같은 회사의 여러 사이트 묶음)">
            <input name="group_name" defaultValue={c?.group_name ?? ""} className="input" />
          </Field>
          <Field label="상태">
            <select name="status" defaultValue={c?.status ?? "active"} className="input">
              <option value="active">진행</option>
              <option value="ended">계약종료</option>
            </select>
          </Field>
          <Field label="영업팀">
            <input name="business_unit" defaultValue={c?.business_unit ?? ""} className="input" />
          </Field>
          <Field label="영업대표">
            <select name="sales_rep_id" defaultValue={c?.sales_rep_id ?? ""} className="input">
              <option value="">선택 안 함</option>
              {salesReps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="업무 범위">
            <input name="business_scope" defaultValue={c?.business_scope ?? ""} className="input" />
          </Field>
          <Choice name="importance" label="중요도" value={c?.importance} options={LEVELS} />
          <Choice name="service_difficulty" label="서비스 난이도" value={c?.service_difficulty} options={LEVELS} />
          <Choice
            name="support_level"
            label="지원 등급"
            value={c?.support_level}
            options={SUPPORT_LEVELS}
            hint={SUPPORT_LEVEL_HINT}
          />
          <Choice name="remote_access" label="원격 지원" value={c?.remote_access} options={REMOTE_ACCESS} />
          <Field label="연간 금액 (원)">
            <input
              name="annual_amount"
              inputMode="numeric"
              defaultValue={c?.annual_amount ?? ""}
              className="input"
            />
          </Field>
        </div>

        <fieldset className="space-y-1.5 text-sm">
          <legend className="text-slate-600">제품</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {PRODUCTS.map((p) => (
              <label key={p} className="flex items-center gap-1.5">
                <input type="checkbox" name="products" value={p} defaultChecked={c?.products.includes(p)} />
                {p}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="제품·버전 메모">
            <input name="product_versions" defaultValue={c?.product_versions ?? ""} className="input" />
          </Field>
          <Field label="점검시기 (예: 매월, 분기 3·6·9·12월)">
            <input name="inspection_cycle_note" defaultValue={c?.inspection_cycle_note ?? ""} className="input" />
          </Field>
          <Field label="지원 횟수">
            <input name="support_count_note" defaultValue={c?.support_count_note ?? ""} className="input" />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">사이트 정보</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            인수인계서에 쓰던 내용입니다. 여기 적어 두면 담당자가 바뀌어도 그대로 이어집니다.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {NARRATIVE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <textarea name={f.key} rows={3} defaultValue={c?.[f.key] ?? ""} className="input" />
            </Field>
          ))}
        </div>
      </section>
    </ActionForm>
  );
}

function Choice({
  name,
  label,
  value,
  options,
  hint,
}: {
  name: string;
  label: string;
  value?: string | null;
  options: readonly string[];
  hint?: Record<string, string>;
}) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value ?? ""} className="input">
        <option value="">미지정</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {hint?.[o] ? `${o} (${hint[o]})` : o}
          </option>
        ))}
      </select>
    </Field>
  );
}
