import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { getKb } from "@/lib/kb";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { KbForm } from "../../kb-form";

type Props = PageProps<"/kb/[id]/edit">;

export default function EditKbPage({ params }: Props) {
  return (
    <>
      <PageHeader title="지식베이스 문서 수정" />
      <Suspense fallback={<ContentSkeleton />}>
        <EditKb params={params} />
      </Suspense>
    </>
  );
}

async function EditKb({ params }: Pick<Props, "params">) {
  const user = await requireRole(pathRoles("/kb"));
  const { id } = await params;
  const article = await getKb(id, user.id);
  if (!article) notFound();
  return (
    <div className="card p-5">
      <KbForm article={article} />
    </div>
  );
}
