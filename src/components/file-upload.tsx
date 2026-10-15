"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmReportUpload, confirmTemplateUpload, prepareUpload } from "@/app/(app)/schedule/actions";
import { Field } from "./action-form";

const MAX_MB = 50;

async function uploadFile(kind: "report" | "template", ownerId: string, file: File) {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`파일은 ${MAX_MB}MB 이하만 올릴 수 있습니다.`);
  const prep = await prepareUpload(kind, ownerId, file.name);
  if (prep.error || !prep.path || !prep.token) throw new Error(prep.error ?? "업로드 준비 실패");
  const bucket = kind === "report" ? "inspection-reports" : "report-templates";
  const { error } = await createClient().storage.from(bucket).uploadToSignedUrl(prep.path, prep.token, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(`업로드 실패: ${error.message}`);
  return prep.path;
}

function useUpload() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const run = async (fn: () => Promise<{ ok?: string; error?: string } | undefined>) => {
    setPending(true);
    setMsg(null);
    try {
      setMsg((await fn()) ?? null);
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : "업로드 중 오류가 났습니다." });
    } finally {
      setPending(false);
    }
  };
  return { pending, msg, run };
}

function Message({ msg }: { msg: { ok?: string; error?: string } | null }) {
  if (!msg) return null;
  return msg.error ? (
    <p role="alert" className="text-sm text-red-700">{msg.error}</p>
  ) : (
    <p role="status" className="text-sm text-emerald-700">{msg.ok}</p>
  );
}

export function ReportUpload({ inspectionId, products }: { inspectionId: string; products: string[] }) {
  const { pending, msg, run } = useUpload();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const file = fd.get("file");
        if (!(file instanceof File) || file.size === 0) return;
        run(async () => {
          const path = await uploadFile("report", inspectionId, file);
          const r = await confirmReportUpload({
            inspectionId,
            path,
            fileName: file.name,
            fileSize: file.size,
            product: (fd.get("product") as string) || null,
            signed: fd.get("signed") === "on",
          });
          if (r?.ok) form.current?.reset();
          return r;
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="결과서 파일 (PDF 권장, 50MB 이하)" className="sm:col-span-2">
          <input name="file" type="file" required accept=".pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.zip" className="input" />
        </Field>
        <Field label="제품">
          <select name="product" defaultValue={products.length === 1 ? products[0] : ""} className="input">
            <option value="">전체</option>
            {products.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" name="signed" /> 고객 확인 서명본
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          <Upload className="size-4" aria-hidden />
          {pending ? "올리는 중…" : "결과서 올리기"}
        </button>
        <Message msg={msg} />
      </div>
    </form>
  );
}

export function TemplateUpload({ customers }: { customers: { id: string; name: string }[] }) {
  const { pending, msg, run } = useUpload();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const file = fd.get("file");
        if (!(file instanceof File) || file.size === 0) return;
        const customerId = (fd.get("customer_id") as string) || null;
        run(async () => {
          const path = await uploadFile("template", customerId ?? "standard", file);
          const r = await confirmTemplateUpload({
            path,
            fileName: file.name,
            name: String(fd.get("name") || file.name.replace(/\.[^.]+$/, "")),
            product: (fd.get("product") as string) || null,
            customerId,
          });
          if (r?.ok) form.current?.reset();
          return r;
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="양식 파일 *">
          <input name="file" type="file" required className="input" />
        </Field>
        <Field label="양식 이름 (비우면 파일명)">
          <input name="name" placeholder="예: Jennifer 정기점검 보고서" className="input" />
        </Field>
        <Field label="제품">
          <select name="product" defaultValue="" className="input">
            <option value="">공통</option>
            <option>WAS</option>
            <option>Jennifer</option>
          </select>
        </Field>
        <Field label="적용 고객사">
          <select name="customer_id" defaultValue="" className="input">
            <option value="">회사 표준 (전체)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} 전용
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-slate-500">같은 이름·제품·고객사로 다시 올리면 새 버전으로 바뀌고 이전 버전은 내려갑니다.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          <Upload className="size-4" aria-hidden />
          {pending ? "올리는 중…" : "양식 올리기"}
        </button>
        <Message msg={msg} />
      </div>
    </form>
  );
}
