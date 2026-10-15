import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { pathRoles } from "@/lib/roles";
import { listStaff } from "@/lib/customers";
import { ContentSkeleton, PageHeader } from "@/components/page-header";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="고객사 추가" />
      <Suspense fallback={<ContentSkeleton />}>
        <NewCustomer />
      </Suspense>
    </>
  );
}

async function NewCustomer() {
  await requireRole(pathRoles("/customers"));
  const salesReps = await listStaff("sales");
  return <CustomerForm salesReps={salesReps} />;
}
