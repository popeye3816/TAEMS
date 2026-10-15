import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { listStaff } from "@/lib/customers";
import { listCustomerOptions } from "@/lib/issues";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { IssueForm } from "../issue-form";

type Props = PageProps<"/issues/new">;

export default function NewIssuePage({ searchParams }: Props) {
  return (
    <>
      <PageHeader title="이슈 등록" description="고객사 장애·문의를 접수합니다." />
      <Suspense fallback={<ContentSkeleton />}>
        <NewIssue searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewIssue({ searchParams }: Pick<Props, "searchParams">) {
  const user = await requireRole(pathRoles("/issues"));
  const sp = await searchParams;
  const [customers, engineers] = await Promise.all([listCustomerOptions(), listStaff("engineer")]);
  const inspectionId = typeof sp.inspection === "string" ? sp.inspection : undefined;
  return (
    <div className="card max-w-4xl p-5">
      <IssueForm
        customers={customers}
        engineers={engineers}
        isAdmin={user.role === "admin"}
        canSelfAssign={engineers.some((e) => e.profile_id === user.id)}
        defaults={{
          customerId: typeof sp.customer === "string" ? sp.customer : undefined,
          inspectionId,
          channel: inspectionId ? "점검 중 발견" : undefined,
        }}
      />
    </div>
  );
}
