"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/action-form";
import { CHANNELS, SEVERITIES } from "@/lib/issue-fields";
import { createIssue, updateIssue } from "./actions";

type CustomerOption = { id: string; name: string; systems: { id: string; label: string }[] };

type Existing = {
  id: string;
  customer_id: string;
  system_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  channel: string | null;
  requester: string | null;
};

export function IssueForm({
  customers,
  engineers,
  isAdmin,
  canSelfAssign,
  defaults,
  issue,
}: {
  customers: CustomerOption[];
  engineers: { id: string; name: string }[];
  isAdmin: boolean;
  canSelfAssign: boolean;
  defaults?: { customerId?: string; inspectionId?: string; channel?: string };
  issue?: Existing;
}) {
  const [customerId, setCustomerId] = useState(issue?.customer_id ?? defaults?.customerId ?? "");
  const systems = customers.find((c) => c.id === customerId)?.systems ?? [];

  return (
    <ActionForm action={issue ? updateIssue : createIssue} submitLabel={issue ? "저장" : "등록"}>
      {issue && <input type="hidden" name="id" value={issue.id} />}
      {defaults?.inspectionId && <input type="hidden" name="inspection_id" value={defaults.inspectionId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="고객사 *">
          <select
            name="customer_id"
            required
            disabled={Boolean(issue)}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              선택
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="관련 시스템">
          <select name="system_id" defaultValue={issue?.system_id ?? ""} key={customerId} className="input">
            <option value="">선택 안 함</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="제목 *" className="sm:col-span-2">
          <input name="title" required defaultValue={issue?.title} placeholder="예: WAS 기동 후 OOM 발생" className="input" />
        </Field>
        <Field label="내용 (증상, 발생 시각, 오류 메시지, 환경)" className="sm:col-span-2">
          <textarea name="description" rows={6} defaultValue={issue?.description ?? ""} className="input" />
        </Field>
        <Field label="심각도">
          <select name="severity" defaultValue={issue?.severity ?? "보통"} className="input">
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="접수 경로">
          <select name="channel" defaultValue={issue?.channel ?? defaults?.channel ?? ""} className="input">
            <option value="">미지정</option>
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="고객 측 요청자">
          <input name="requester" defaultValue={issue?.requester ?? ""} placeholder="예: 김선덕 과장" className="input" />
        </Field>
        {!issue && (
          <>
            <Field label="접수 시각 (비우면 지금, 한국 시간)">
              <input name="received_at" type="datetime-local" className="input" />
            </Field>
            <Field label="담당">
              <select name="assignee_id" defaultValue="" className="input">
                <option value="">미배정 (관리자가 배정)</option>
                {canSelfAssign && <option value="me">내가 맡기</option>}
                {isAdmin &&
                  engineers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </Field>
          </>
        )}
      </div>
    </ActionForm>
  );
}
