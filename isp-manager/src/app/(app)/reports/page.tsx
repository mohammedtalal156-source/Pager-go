import type { Metadata } from "next";
import { requireSection } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { ComingInPhase } from "@/components/app/coming-in-phase";

export const metadata: Metadata = { title: "التقارير" };

export default async function Page() {
  await requireSection("reports");
  return (
    <>
      <PageHeader title="التقارير" />
      <ComingInPhase phase={5} items={["تقارير المقبوضات والديون والاشتراكات المنتهية", "أداء الأبراج وتحصيل الموظفين", "التصدير إلى Excel"]} />
    </>
  );
}
