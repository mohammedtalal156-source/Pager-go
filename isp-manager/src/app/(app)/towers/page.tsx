import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { ComingInPhase } from "@/components/app/coming-in-phase";

export const metadata: Metadata = { title: "الأبراج" };

export default async function Page() {
  await requireSection("towers");
  return (
    <>
      <PageHeader title="الأبراج" />
      <ComingInPhase phase={2} items={["إضافة وتعديل وأرشفة الأبراج", "عدد المشتركين الفعالين والمنتهين لكل برج", "مقبوضات وديون كل برج"]} />
    </>
  );
}
