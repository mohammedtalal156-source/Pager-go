import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { ComingInPhase } from "@/components/app/coming-in-phase";

export const metadata: Metadata = { title: "الحسابات" };

export default async function Page() {
  await requireSection("finance");
  return (
    <>
      <PageHeader title="الحسابات" />
      <ComingInPhase phase={5} items={["المقبوضات اليومية والشهرية", "الديون والمصروفات", "صافي التدفق النقدي لكل برج أو لجميع الأبراج"]} />
    </>
  );
}
