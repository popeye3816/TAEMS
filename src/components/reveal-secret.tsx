"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { RevealResult } from "@/app/(app)/customers/actions";

const LABELS: Record<string, string> = { ip: "IP", username: "계정", password: "비밀번호" };

// 암호화된 값을 눌렀을 때만 서버에서 복호화해 보여준다. 열람 기록이 남는다.
export function RevealSecret({
  reveal,
  label = "보기",
}: {
  reveal: () => Promise<RevealResult>;
  label?: string;
}) {
  const [values, setValues] = useState<Record<string, string | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (values) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {Object.entries(values).map(([k, v]) => (
          <span key={k} className="font-mono text-xs">
            {Object.keys(values).length > 1 && <span className="text-slate-500">{LABELS[k] ?? k}: </span>}
            <span className="select-all rounded bg-amber-50 px-1 py-0.5">{v ?? "(없음)"}</span>
          </span>
        ))}
        <button type="button" onClick={() => setValues(null)} className="text-slate-500" aria-label="숨기기">
          <EyeOff className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reveal();
            if (r.error) setError(r.error);
            else setValues(r.values ?? {});
          })
        }
        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline disabled:opacity-50"
      >
        <Eye className="size-3.5" aria-hidden />
        {pending ? "확인 중…" : label}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
