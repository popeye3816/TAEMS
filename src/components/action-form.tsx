"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";

type State = { ok?: string; error?: string } | undefined;

// 서버 액션을 실행하고 결과 메시지를 보여주는 폼. 성공하면 입력값을 비운다(resetOnSuccess).
export function ActionForm({
  action,
  children,
  submitLabel = "저장",
  resetOnSuccess = false,
  onSuccess,
  className,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  children: ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    onSuccess?.();
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form ref={ref} action={formAction} className={clsx("space-y-4", className)}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "처리 중…" : submitLabel}
        </button>
        {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-emerald-700">{state.ok}</p>}
      </div>
    </form>
  );
}

// 삭제처럼 되돌릴 수 없는 작업 전에 확인을 받는 버튼
export function ConfirmSubmit({
  action,
  id,
  message,
  label = "삭제",
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  message: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-red-700 hover:underline">
        {label}
      </button>
    </form>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block space-y-1 text-sm", className)}>
      <span className="text-slate-600">{label}</span>
      {children}
    </label>
  );
}
