"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card max-w-md space-y-4 p-5">
      <h2 className="text-sm font-semibold text-slate-900">비밀번호 변경</h2>
      <label className="block space-y-1 text-sm">
        <span className="text-slate-700">새 비밀번호 (8자 이상)</span>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-slate-700">새 비밀번호 확인</span>
        <input name="confirm" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "변경 중…" : "변경"}
        </button>
        {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-emerald-700">{state.ok}</p>}
      </div>
    </form>
  );
}
