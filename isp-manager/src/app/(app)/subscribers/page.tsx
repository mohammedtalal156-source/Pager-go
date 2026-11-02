import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { ComingInPhase } from "@/components/app/coming-in-phase";

export const metadata: Metadata = { title: "المشتركين" };

export default async function Page() {
  await requireSection("subscribers");
  return (
    <>
      <PageHeader title="المشتركين" />
      <ComingInPhase phase={3} items={["جدول المشتركين مع بحث فوري بالاسم أو الهاتف أو رقم المشترك", "إضافة وتعديل وأرشفة المشتركين", "فلاتر حسب البرج والحالة والديون", "أزرار اتصال وواتساب"]} />
    </>
  );
}
