import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, RadioTower, User } from "lucide-react";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatIQD } from "@/lib/utils";
import type { Tower, TowerStats } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArchiveTowerButton, TowerDialog } from "./tower-dialog";

export const metadata: Metadata = { title: "الأبراج" };

export default async function TowersPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const staff = await requireSection("towers");
  const isAdmin = staff.role === "admin";
  const showArchived = (await searchParams).archived === "1";
  const supabase = await createClient();

  const [towersRes, statsRes] = await Promise.all([
    supabase.from("towers").select("*").eq("is_archived", showArchived).order("name").returns<Tower[]>(),
    supabase.rpc("tower_stats"),
  ]);
  const stats = new Map(((statsRes.data ?? []) as TowerStats[]).map((s) => [s.tower_id, s]));
  const towers = towersRes.data ?? [];

  return (
    <>
      <PageHeader
        title="الأبراج"
        description={showArchived ? "الأبراج المؤرشفة" : `${towers.length} برج`}
        actions={
          <>
            <Link
              href={showArchived ? "/towers" : "/towers?archived=1"}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent"
            >
              {showArchived ? "عرض الأبراج الفعالة" : "عرض المؤرشفة"}
            </Link>
            {isAdmin && !showArchived && <TowerDialog />}
          </>
        }
      />
      {(towersRes.error || statsRes.error) && (
        <Alert variant="destructive" className="mb-4">
          {towersRes.error?.message ?? statsRes.error?.message}
        </Alert>
      )}

      {towers.length === 0 ? (
        <EmptyState
          icon={RadioTower}
          title={showArchived ? "لا توجد أبراج مؤرشفة" : "لا توجد أبراج بعد"}
          hint={!showArchived && isAdmin ? "اضغط «إضافة برج» للبدء" : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {towers.map((t) => {
            const st = stats.get(t.id);
            return (
              <div key={t.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <Link href={`/towers/${t.id}`} className="group grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-semibold group-hover:text-primary">
                      <RadioTower className="size-4 text-primary" /> {t.name}
                    </h2>
                    {t.is_archived && <Badge variant="secondary">مؤرشف</Badge>}
                  </div>
                  {(t.area || t.address) && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {[t.area, t.address].filter(Boolean).join(" — ")}
                    </p>
                  )}
                </Link>
                {(t.manager_name || t.manager_phone) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {t.manager_name && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <User className="size-3" /> {t.manager_name}
                      </span>
                    )}
                    {t.manager_phone && (
                      <a href={`tel:${t.manager_phone}`} className="flex items-center gap-1 text-primary" dir="ltr">
                        <Phone className="size-3" /> {t.manager_phone}
                      </a>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-lg font-bold tabular-nums">{st?.subscribers ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">مشترك</p>
                  </div>
                  <div className="rounded-lg bg-success-soft p-2">
                    <p className="text-lg font-bold text-success tabular-nums">{st?.active ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">فعال</p>
                  </div>
                  <div className="rounded-lg bg-danger-soft p-2">
                    <p className="text-lg font-bold text-danger tabular-nums">{st?.expired ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">منتهي</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span>
                    مقبوضات الشهر: <b className="text-success">{formatIQD(st?.collected_month)}</b>
                  </span>
                  <span>
                    الديون: <b className="text-danger">{formatIQD(st?.debt)}</b>
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 border-t pt-3">
                    {!t.is_archived && <TowerDialog tower={t} />}
                    <ArchiveTowerButton id={t.id} archived={t.is_archived} name={t.name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
