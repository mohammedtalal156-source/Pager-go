import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { ComingInPhase } from "@/components/app/coming-in-phase";

export const metadata: Metadata = { title: "الباقات" };

export default async function Page() {
  await requireSection("packages");
  return (
    <>
      <PageHeader title="الباقات" />
      <ComingInPhase phase={2} items={["إضافة وتعديل الباقات (السعر، المدة، السرعة)", "تفعيل وإيقاف الباقات"]} />
    </>
  );
}
