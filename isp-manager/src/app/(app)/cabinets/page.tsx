import type { Metadata } from "next";
import Link from "next/link";
import { UtilityPole } from "lucide-react";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { groupByPole } from "@/lib/pole";
import { formatIQD } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "الكابينات" };

type Row = { pole: string | null; search_text: string | null; status: string; balance: number; tower_name: string };

export default async function CabinetsPage() {
  await requireSection("cabinets");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriber_overview")
    .select("pole, search_text, status, balance, tower_name")
    .eq("is_archived", false)
    .range(0, 9999)
    .returns<Row[]>();
  const { poles, withoutPole } = groupByPole(data ?? []);
  const n = new Intl.NumberFormat("en-US");

  return (
    <>
      <PageHeader title="الكابينات" description={`${n.format(poles.length)} عامود`} />
      {error && <Alert variant="destructive" className="mb-4">{error.message}</Alert>}
      {poles.length === 0 ? (
        <EmptyState icon={UtilityPole} title="لا توجد عواميد بعد — أضف رقم العامود من «تعديل المشترك»" />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {poles.map((p) => (
            <Link
              key={p.pole}
              href={`/subscribers?q=${encodeURIComponent(`عامود ${p.pole}`)}`}
              className="rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/40"
            >
              <p className="flex items-center gap-1.5 font-bold">
                <UtilityPole className="size-4 text-primary" /> عامود {p.pole}
              </p>
              <p className="mt-1 text-sm">
                <b className="tabular-nums">{n.format(p.count)}</b> مشترك
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="text-success">{n.format(p.active)} فعال</span>
                {p.expired > 0 && <span className="text-danger"> · {n.format(p.expired)} منتهي</span>}
              </p>
              {p.debt > 0 && <p className="mt-0.5 text-xs font-semibold text-danger">دين {formatIQD(p.debt)}</p>}
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.towers.join("، ")}</p>
            </Link>
          ))}
        </div>
      )}
      {withoutPole > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {n.format(withoutPole)} مشترك بدون رقم عامود. أضفه من «تعديل المشترك» حتى يظهر هنا.
        </p>
      )}
    </>
  );
}
