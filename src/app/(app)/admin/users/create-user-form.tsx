"use client";

import { useActionState, useEffect, useRef } from "react";
import { ROLE_LABELS, ROLES } from "@/lib/roles";
import { createUser } from "./actions";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-slate-900">사용자 추가</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">이름</span>
          <input name="name" required className="input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">회사 이메일</span>
          <input name="email" type="email" required placeholder="name@unipoint.co.kr" className="input" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">역할</span>
          <select name="role" defaultValue="engineer" className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">임시 비밀번호 (8자 이상)</span>
          <input name="password" type="text" minLength={8} required autoComplete="off" className="input" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "등록 중…" : "추가"}
        </button>
        {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-emerald-700">{state.ok}</p>}
      </div>
    </form>
  );
}
