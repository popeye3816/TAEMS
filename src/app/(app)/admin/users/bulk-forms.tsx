"use client";

import { useActionState } from "react";
import { Download, KeyRound } from "lucide-react";
import { bulkCreateUsers, resetPassword, type BulkState, type IssuedPassword } from "./actions";

// 발급한 임시 비밀번호는 이 화면에서 한 번만 보여준다. 저장되지 않는다.
function Issued({ results }: { results: IssuedPassword[] }) {
  const ok = results.filter((r) => r.password);
  const download = () => {
    const csv = "﻿이름,이메일,역할,임시 비밀번호\n" + ok.map((r) => `${r.name},${r.email},${r.role},${r.password}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `임시비밀번호_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">
        임시 비밀번호는 지금 한 번만 보입니다. 본인에게 따로(메신저 개인 대화 등) 전달하세요. 처음 로그인하면 바꾸도록 안내됩니다.
      </p>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-amber-200">
          {results.map((r, i) => (
            <tr key={i}>
              <td className="py-1 pr-2">{r.name}</td>
              <td className="pr-2">{r.email}</td>
              <td className="pr-2">{r.role}</td>
              <td className="font-mono">{r.password ? <span className="select-all">{r.password}</span> : <span className="text-red-700">{r.error}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ok.length > 1 && (
        <button type="button" onClick={download} className="btn-secondary">
          <Download className="size-4" aria-hidden /> CSV로 저장
        </button>
      )}
    </div>
  );
}

export function BulkCreateForm() {
  const [state, action, pending] = useActionState<BulkState, FormData>(bulkCreateUsers, undefined);
  return (
    <form action={action} className="card space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">여러 명 한꺼번에 등록</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          한 줄에 한 명씩 <code>이름, 이메일, 역할</code> (역할: 관리자 / 엔지니어 / 영업). 엑셀에서 세 열을 복사해 붙여넣어도 됩니다.
          임시 비밀번호는 자동으로 만들어집니다. 직원 명단에 같은 이름이 있으면 자동으로 연결됩니다.
        </p>
      </div>
      <textarea
        name="lines"
        rows={6}
        required
        aria-label="등록할 사용자 목록"
        placeholder={"차민주, mjcha@unipoint.co.kr, 엔지니어\n김종욱, jwkim@unipoint.co.kr, 영업"}
        className="input font-mono text-xs"
      />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "등록 중…" : "등록"}
      </button>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.results && <Issued results={state.results} />}
    </form>
  );
}

export function ResetPasswordButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<BulkState, FormData>(resetPassword, undefined);
  return (
    <div>
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`${name}의 임시 비밀번호를 새로 발급할까요? 기존 비밀번호는 쓸 수 없게 됩니다.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
          <KeyRound className="size-3.5" aria-hidden /> {pending ? "발급 중…" : "임시 비밀번호 재발급"}
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state?.results && <div className="mt-2"><Issued results={state.results} /></div>}
    </div>
  );
}
