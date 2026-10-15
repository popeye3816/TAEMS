import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { KbForm } from "../kb-form";

export default function NewKbPage() {
  return (
    <>
      <PageHeader title="지식베이스 문서 작성" />
      <Suspense fallback={<ContentSkeleton />}>
        <NewKb />
      </Suspense>
    </>
  );
}

async function NewKb() {
  await requireRole(pathRoles("/kb"));
  return (
    <div className="card p-5">
      <KbForm />
    </div>
  );
}
