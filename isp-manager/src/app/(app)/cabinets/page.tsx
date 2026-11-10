import type { Metadata } from "next";
import Link from "next/link";
import { UtilityPole } from "lucide-react";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { groupByPole, mergePoles } from "@/lib/pole";
import { requireCurrentTower } from "@/lib/current-tower-server";
import { formatIQD } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Alert } from "@/components/ui/alert";
import { AddPoleForm, RemovePoleButton } from "./controls";

export const metadata: Metadata = { title: "الكابينات" };

type Row = { pole: string | null; search_text: string | null; status: string; balance: number; tower_name: string };

export default async function CabinetsPage() {
  const staff = await requireSection("cabinets");
  const isAdmin = staff.role === "admin";
  const supabase = await createClient();
  const { tower } = await requireCurrentTower(supabase);
  let subsQ = supabase
    .from("subscriber_overview")
    .select("pole, search_text, status, balance, tower_name")
    .eq("is_archived", false);
  if (tower) subsQ = subsQ.eq("tower_id", tower.id);
  const [subs, list] = await Promise.all([
    subsQ
      .range(0, 9999)
      .returns<Row[]>(),
    supabase.from("poles").select("name").is("hidden_at", null).range(0, 9999).returns<{ name: string }[]>(),
  ]);
  const { poles: used, withoutPole } = groupByPole(subs.data ?? []);
  const poles = mergePoles((list.data ?? []).map((p) => p.name), used);
  const error = subs.error ?? list.error;
  const n = new Intl.NumberFormat("en-US");

  return (
    <>
      <PageHeader title="الكابينات" description={`${tower ? `${tower.name} · ` : ""}${n.format(poles.length)} عامود`} />
      {error && <Alert variant="destructive" className="mb-4">{error.message}</Alert>}
      {isAdmin && <AddPoleForm />}
      {poles.length === 0 ? (
        <EmptyState icon={UtilityPole} title="لا توجد عواميد بعد" />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {poles.map((p) => (
            <div key={p.pole} className="relative rounded-xl border bg-card shadow-sm transition-colors hover:bg-accent/40">
              <Link href={`/subscribers?q=${encodeURIComponent(`عامود ${p.pole}`)}`} className="block p-3">
                <p className="flex items-center gap-1.5 font-bold">
                  <UtilityPole className="size-4 text-primary" /> عامود {p.pole}
                </p>
                <p className="mt-1 text-sm">
                  {p.count === 0 ? (
                    <span className="text-muted-foreground">لا يوجد مشتركين</span>
                  ) : (
                    <>
                      <b className="tabular-nums">{n.format(p.count)}</b> مشترك
                    </>
                  )}
                </p>
                {p.count > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="text-success">{n.format(p.active)} فعال</span>
                    {p.expired > 0 && <span className="text-danger"> · {n.format(p.expired)} منتهي</span>}
                  </p>
                )}
                {p.debt > 0 && <p className="mt-0.5 text-xs font-semibold text-danger">دين {formatIQD(p.debt)}</p>}
                {p.towers.length > 0 && <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.towers.join("، ")}</p>}
              </Link>
              {isAdmin && p.removable && <RemovePoleButton pole={p.pole} />}
            </div>
          ))}
        </div>
      )}
      {isAdmin && (
        <p className="mt-4 text-xs text-muted-foreground">
          زر الحذف يظهر على العامود الفارغ فقط. العامود الذي عليه مشتركون يُحذف بعد نقلهم لعامود آخر من «تعديل المشترك».
        </p>
      )}
      {withoutPole > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {n.format(withoutPole)} مشترك بدون رقم عامود. أضفه من «تعديل المشترك» حتى يظهر هنا.
        </p>
      )}
    </>
  );
}
