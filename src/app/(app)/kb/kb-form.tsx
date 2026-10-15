"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/action-form";
import { KB_CATEGORIES, KB_KIND_LABEL, type KbKind } from "@/lib/kb-fields";
import { saveKb } from "./actions";

type Article = {
  id: string;
  kind: string;
  status: string;
  title: string;
  category: string;
  product: string | null;
  environment: string | null;
  tags: string[];
  symptom: string | null;
  cause: string | null;
  solution: string | null;
  content: string | null;
};

export function KbForm({ article }: { article?: Article }) {
  const a = article;
  const [kind, setKind] = useState<KbKind>((a?.kind as KbKind) ?? "case");

  return (
    <ActionForm action={saveKb} submitLabel={a ? "저장" : "등록"}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 text-slate-600">종류</legend>
        {(Object.keys(KB_KIND_LABEL) as KbKind[]).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            {KB_KIND_LABEL[k]}
            <span className="text-xs text-slate-500">{k === "case" ? "(증상·원인·해결)" : "(작업 절차·설정 방법 등)"}</span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="제목 *" className="sm:col-span-2 lg:col-span-4">
          <input name="title" required defaultValue={a?.title} className="input" />
        </Field>
        <Field label="분류">
          <select name="category" defaultValue={a?.category ?? "WAS"} className="input">
            {KB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="제품·버전">
          <input name="product" defaultValue={a?.product ?? ""} placeholder="예: WebSphere 9.0.5" className="input" />
        </Field>
        <Field label="환경">
          <input name="environment" defaultValue={a?.environment ?? ""} placeholder="예: RHEL 8, ND 클러스터" className="input" />
        </Field>
        <Field label="태그 (쉼표로 구분)">
          <input name="tags" defaultValue={a?.tags.join(", ") ?? ""} placeholder="OOM, heapdump" className="input" />
        </Field>
      </div>

      {kind === "case" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="증상 (게시하려면 필수)">
            <textarea name="symptom" rows={7} defaultValue={a?.symptom ?? ""} placeholder="어떤 현상이었는지, 오류 메시지" className="input" />
          </Field>
          <Field label="원인">
            <textarea name="cause" rows={7} defaultValue={a?.cause ?? ""} className="input" />
          </Field>
          <Field label="해결 방법 (게시하려면 필수)">
            <textarea name="solution" rows={7} defaultValue={a?.solution ?? ""} placeholder="실제로 한 조치, 명령어, 설정값" className="input" />
          </Field>
          <Field label="추가 설명 (마크다운)" className="lg:col-span-3">
            <textarea name="content" rows={5} defaultValue={a?.content ?? ""} className="input font-mono text-xs" />
          </Field>
        </div>
      ) : (
        <Field label="본문 (마크다운: # 제목, - 목록, ```코드```)">
          <textarea name="content" rows={20} defaultValue={a?.content ?? ""} className="input font-mono text-xs" />
        </Field>
      )}

      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 text-slate-600">상태</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="status" value="draft" defaultChecked={a?.status !== "published"} /> 초안 (작성 중)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="status" value="published" defaultChecked={a?.status === "published"} /> 게시
        </label>
      </fieldset>
      <p className="text-xs text-slate-500">고객사 IP·계정·연락처는 지식베이스에 쓰지 말고 고객사 화면의 접속정보에 넣어 주세요.</p>
    </ActionForm>
  );
}
