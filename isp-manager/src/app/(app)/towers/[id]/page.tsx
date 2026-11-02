import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Phone, Users } from "lucide-react";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatIQD } from "@/lib/utils";
import type { DashboardStats, SubscriptionStatus, Tower } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";

export const metadata: Metadata = { title: "تفاصيل البرج" };

type Row = {
  id: string;
  code: number;
  full_name: string;
  phone: string;
  package_name: string | null;
  end_date: string | null;
  days_left: number | null;
  status: SubscriptionStatus;
  balance: number;
};

export default async function TowerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("towers");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();

  const [towerRes, statsRes, subsRes] = await Promise.all([
    supabase.from("towers").select("*").eq("id", id).maybeSingle<Tower>(),
    supabase.rpc("dashboard_stats", { p_tower_id: id }),
    supabase
      .from("subscriber_overview")
      .select("id, code, full_name, phone, package_name, end_date, days_left, status, balance")
      .eq("tower_id", id)
      .eq("is_archived", false)
      .order("end_date", { ascending: true, nullsFirst: true })
      .returns<Row[]>(),
  ]);
  const tower = towerRes.data;
  if (!tower) notFound();
  const s = statsRes.data as DashboardStats | null;
  const subs = subsRes.data ?? [];

  return (
    <>
      <Link href="/towers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> الأبراج
      </Link>
      <PageHeader title={tower.name} description={[tower.area, tower.address].filter(Boolean).join(" — ") || undefined} />

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {tower.manager_name && <span>المسؤول: {tower.manager_name}</span>}
        {tower.manager_phone && (
          <a href={`tel:${tower.manager_phone}`} className="flex items-center gap-1 text-primary" dir="ltr">
            <Phone className="size-3.5" /> {tower.manager_phone}
          </a>
        )}
        {tower.notes && <span className="text-muted-foreground">{tower.notes}</span>}
      </div>

      {s && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["المشتركين", String(s.total), ""],
            ["فعال", String(s.active), "text-success"],
            ["منتهي", String(s.expired), "text-danger"],
            ["مقبوضات الشهر", formatIQD(s.collected_month), "text-success"],
            ["الديون", formatIQD(s.debt), "text-danger"],
          ].map(([label, value, cls]) => (
            <div key={label} className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <Users className="size-4" /> المشتركين ({subs.length})
      </h2>
      {subs.length === 0 ? (
        <EmptyState icon={MapPin} title="لا يوجد مشتركين في هذا البرج بعد" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="divide-y">
            {subs.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">#{r.code}</p>
                </div>
                <a href={`tel:${r.phone}`} className="hidden text-sm text-primary sm:block" dir="ltr">
                  {r.phone}
                </a>
                <span className="hidden text-sm sm:block">{formatDate(r.end_date)}</span>
                <span className={`hidden text-sm tabular-nums sm:block ${r.balance > 0 ? "text-danger" : "text-muted-foreground"}`}>
                  {r.balance > 0 ? formatIQD(r.balance) : "—"}
                </span>
                <StatusBadge status={r.status} daysLeft={r.days_left} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
