import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { getCustomer, listStaff } from "@/lib/customers";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { CustomerForm } from "../../customer-form";

export default function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  return (
    <>
      <PageHeader title="고객사 정보 수정" />
      <Suspense fallback={<ContentSkeleton />}>
        <EditCustomer params={params} />
      </Suspense>
    </>
  );
}

async function EditCustomer({ params }: { params: PageProps<"/customers/[id]/edit">["params"] }) {
  await requireRole(pathRoles("/customers"));
  const { id } = await params;
  const [customer, salesReps] = await Promise.all([getCustomer(id), listStaff("sales")]);
  if (!customer) notFound();
  return <CustomerForm customer={customer} salesReps={salesReps} />;
}
