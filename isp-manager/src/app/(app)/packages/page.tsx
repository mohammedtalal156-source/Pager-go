import type { Metadata } from "next";
import { Package as PackageIcon } from "lucide-react";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatIQD } from "@/lib/utils";
import type { Package } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PackageActiveSwitch, PackageDialog } from "./package-dialog";

export const metadata: Metadata = { title: "الباقات" };

export default async function PackagesPage() {
  const staff = await requireSection("packages");
  const isAdmin = staff.role === "admin";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packages")
    .select("id, name, price, duration_days, description, is_active")
    .order("is_active", { ascending: false })
    .order("price")
    .returns<Package[]>();
  const packages = data ?? [];

  return (
    <>
      <PageHeader title="الباقات" description={`${packages.filter((p) => p.is_active).length} باقة فعّالة`} actions={isAdmin && <PackageDialog />} />
      {error && <Alert variant="destructive" className="mb-4">{error.message}</Alert>}
      {packages.length === 0 ? (
        <EmptyState icon={PackageIcon} title="لا توجد باقات بعد" hint={isAdmin ? "اضغط «إضافة باقة» للبدء" : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map((p) => (
            <div key={p.id} className={`flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm ${p.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <Badge variant={p.is_active ? "success" : "secondary"}>{p.is_active ? "فعّالة" : "متوقفة"}</Badge>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-primary tabular-nums">{formatIQD(p.price)}</p>
                <p className="text-sm text-muted-foreground">{p.duration_days} يوم</p>
              </div>
              {isAdmin && (
                <div className="flex items-center justify-between border-t pt-3">
                  <PackageDialog pkg={p} />
                  <PackageActiveSwitch id={p.id} active={p.is_active} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
