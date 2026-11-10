import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Banknote, CalendarRange, HandCoins, MapPin, Phone, StickyNote } from "lucide-react";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatDateTime, formatIQD } from "@/lib/utils";
import { can, type Collector, type Package, type SubscriberPerms, type SubscriberRow, type Tower } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { WhatsAppPhone } from "@/components/app/whatsapp-phone";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriberQuickActions } from "../quick-dialogs";
import { EditSubscriberButton } from "../subscriber-form";
import { AdjustDebtButton, ArchiveSubscriberButton, CorrectPaymentButton, DatesButton, DeleteSubscriberButton, HistoryButton, VoidButton } from "./controls";

export const metadata: Metadata = { title: "تفاصيل المشترك" };

const COLUMNS =
  "id, code, full_name, phone, phone2, tower_id, tower_name, pole, area, address, package_id, package_name, price, start_date, end_date, days_left, status, balance, collector_id, notes, is_archived, tower_monthly";

type Period = {
  id: string;
  kind: "new" | "renewal" | "import";
  start_date: string;
  end_date: string;
  price: number;
  created_at: string;
  is_voided: boolean;
  void_reason: string | null;
  packages: { name: string } | null;
  renewals: { id: string; seq: number }[];
};
type Pay = {
  id: string;
  receipt_no: number;
  kind: "new_subscription" | "renewal" | "collection";
  amount: number;
  paid_at: string;
  notes: string | null;
  is_voided: boolean;
  void_reason: string | null;
  corrects_payment_id: string | null;
  receiver: { full_name: string } | null;
};
type Adjustment = {
  id: string;
  amount: number;
  previous_balance: number;
  new_balance: number;
  reason: string;
  created_at: string;
  admin: { full_name: string } | null;
};

const KIND = { new: "اشتراك جديد", renewal: "تجديد", import: "مستورد" } as const;
const PAY_KIND = { new_subscription: "اشتراك جديد", renewal: "تجديد", collection: "تحصيل دين" } as const;

export default async function SubscriberPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireSection("subscribers");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();

  const [subRes, periodsRes, paysRes, towersRes, packagesRes, collectorsRes, adjRes] = await Promise.all([
    supabase.from("subscriber_overview").select(COLUMNS).eq("id", id).maybeSingle<SubscriberRow>(),
    supabase
      .from("subscriptions")
      .select("id, kind, start_date, end_date, price, created_at, is_voided, void_reason, packages(name), renewals(id, seq)")
      .eq("subscriber_id", id)
      .order("start_date", { ascending: false })
      .returns<Period[]>(),
    supabase
      .from("payments")
      .select("id, receipt_no, kind, amount, paid_at, notes, is_voided, void_reason, corrects_payment_id, receiver:profiles!payments_received_by_fkey(full_name)")
      .eq("subscriber_id", id)
      .order("paid_at", { ascending: false })
      .returns<Pay[]>(),
    supabase.from("towers").select("id, name, area").eq("is_archived", false).order("name").returns<Pick<Tower, "id" | "name" | "area">[]>(),
    supabase.from("packages").select("id, name, price, duration_days, description, is_active").order("price").returns<Package[]>(),
    supabase.rpc("list_collectors"),
    supabase
      .from("debt_adjustments")
      .select("id, amount, previous_balance, new_balance, reason, created_at, admin:profiles!debt_adjustments_created_by_fkey(full_name)")
      .eq("subscriber_id", id)
      .order("created_at", { ascending: false })
      .returns<Adjustment[]>(),
  ]);
  const sub = subRes.data;
  const adjustments = adjRes.data ?? [];
  if (!sub) notFound();
  const periods = periodsRes.data ?? [];
  const pays = paysRes.data ?? [];
  const collectors = (collectorsRes.data ?? []) as Collector[];
  const lists = { towers: towersRes.data ?? [], packages: packagesRes.data ?? [], collectors };
  const perms: SubscriberPerms = {
    create: can(staff, "create_subscribers"),
    edit: can(staff, "edit_subscribers"),
    renew: can(staff, "renew"),
    collect: can(staff, "collect"),
    admin: staff.role === "admin",
  };
  const isAdmin = perms.admin;
  const latestRenewal = periods
    .filter((p) => !p.is_voided && p.renewals.length > 0)
    .map((p) => p.renewals[0])
    .sort((a, b) => b.seq - a.seq)[0];
  const collector = collectors.find((c) => c.id === sub.collector_id);
  const paidTotal = pays.filter((p) => !p.is_voided).reduce((s, p) => s + p.amount, 0);
  const receiptById = new Map(pays.map((p) => [p.id, p.receipt_no]));
  const correctedBy = new Map(pays.filter((p) => p.corrects_payment_id).map((p) => [p.corrects_payment_id!, p.receipt_no]));
  const lookups = {
    towers: Object.fromEntries([[sub.tower_id, sub.tower_name], ...lists.towers.map((t) => [t.id, t.name])]),
    packages: Object.fromEntries(lists.packages.map((p) => [p.id, p.name])),
    staff: Object.fromEntries(collectors.map((c) => [c.id, c.full_name])),
  };
  const canEdit = perms.edit && !sub.is_archived;

  return (
    <>
      <Link href="/subscribers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> المشتركين
      </Link>
      <PageHeader
        title={sub.full_name}
        description={`رقم المشترك #${sub.code}${sub.is_archived ? " · مؤرشف" : ""}`}
        actions={<StatusBadge status={sub.status} daysLeft={sub.days_left} />}
      />

      <div className="mb-3">
        <SubscriberQuickActions sub={sub} packages={lists.packages} perms={perms} />
      </div>

      {(canEdit || isAdmin) && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border bg-card p-2 sm:flex sm:flex-wrap">
          {canEdit && <EditSubscriberButton sub={sub} lists={lists} className="h-11" />}
          {isAdmin && <AdjustDebtButton subscriberId={sub.id} balance={sub.balance} className="h-11" />}
          {isAdmin && <DatesButton id={sub.id} start={sub.start_date} end={sub.end_date} className="h-11" />}
          {isAdmin && <HistoryButton subscriberId={sub.id} lookups={lookups} className="h-11" />}
          {(perms.edit || isAdmin) && <ArchiveSubscriberButton id={sub.id} archived={sub.is_archived} className="h-11" />}
          {isAdmin && <DeleteSubscriberButton id={sub.id} name={sub.full_name} paidTotal={paidTotal} className="h-11" />}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">انتهاء الاشتراك</p>
                <p className={cn("font-bold", sub.status === "expired" ? "text-danger" : sub.status === "expiring" ? "text-warning" : "text-success")}>
                  {formatDate(sub.end_date)}
                </p>
              </div>
              <div className={cn("rounded-lg p-3", sub.balance > 0 ? "bg-danger-soft" : "bg-success-soft")}>
                <p className="text-xs text-muted-foreground">المبلغ المتبقي</p>
                <p className={cn("font-bold", sub.balance > 0 ? "text-danger" : "text-success")}>{formatIQD(sub.balance)}</p>
              </div>
            </div>
            <p className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <WhatsAppPhone phone={sub.phone} />
              {sub.phone2 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <WhatsAppPhone phone={sub.phone2} />
                </>
              )}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              {sub.tower_name}
              {sub.pole && ` · عامود ${sub.pole}`}
              {sub.area && ` · ${sub.area}`}
              {sub.address && ` · ${sub.address}`}
            </p>
            <p className="flex items-center gap-2">
              <CalendarRange className="size-4 text-muted-foreground" />
              {sub.package_name ?? "بدون باقة"} · {formatIQD(sub.price)} · من {formatDate(sub.start_date)}
            </p>
            {collector && <p className="text-muted-foreground">المحصّل: {collector.full_name}</p>}
            {sub.notes && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <StickyNote className="mt-0.5 size-4" /> {sub.notes}
              </p>
            )}
            <p className="text-xs text-muted-foreground">إجمالي المدفوع: {formatIQD(paidTotal)}</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="size-4 text-primary" /> سجل الاشتراكات والتجديدات
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {periods.length === 0 && <p className="text-sm text-muted-foreground">لا توجد فترات اشتراك مسجلة.</p>}
              {periods.map((p) => (
                <div key={p.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm", p.is_voided && "opacity-50")}>
                  <div>
                    <p className="font-medium">
                      {KIND[p.kind]} · {formatDate(p.start_date)} ← {formatDate(p.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.packages?.name ?? "—"} · سُجّل {formatDateTime(p.created_at)}
                      {p.is_voided && ` · ملغى: ${p.void_reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatIQD(p.price)}</span>
                    {p.is_voided && <Badge variant="secondary">ملغى</Badge>}
                    {isAdmin && !p.is_voided && latestRenewal && p.renewals[0]?.id === latestRenewal.id && (
                      <VoidButton kind="renewal" id={latestRenewal.id} subscriberId={sub.id} label={`التجديد حتى ${formatDate(p.end_date)}`} />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {adjustments.length > 0 && (
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HandCoins className="size-4 text-warning" /> تسويات الدين
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {adjustments.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                    <div>
                      <p className="font-medium tabular-nums">
                        {formatIQD(a.previous_balance)} ← {formatIQD(a.new_balance)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(a.created_at)} · {a.admin?.full_name ?? "—"} · {a.reason}
                      </p>
                    </div>
                    <Badge variant="secondary" className={cn("tabular-nums", a.amount > 0 ? "text-danger" : "text-success")}>
                      {a.amount > 0 ? "زيادة +" : "تخفيض −"}
                      {formatIQD(Math.abs(a.amount))}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="size-4 text-success" /> سجل الدفعات
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {pays.length === 0 && <p className="text-sm text-muted-foreground">لا توجد دفعات مسجلة.</p>}
              {pays.map((p) => (
                <div key={p.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm", p.is_voided && "opacity-50")}>
                  <div>
                    <p className="font-medium">
                      {PAY_KIND[p.kind]} · وصل #{p.receipt_no}
                      {p.corrects_payment_id && (
                        <Badge variant="secondary" className="ms-2">
                          تصحيح للوصل #{receiptById.get(p.corrects_payment_id) ?? "—"}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(p.paid_at)} · استلمها {p.receiver?.full_name ?? "—"}
                      {p.notes && ` · ${p.notes}`}
                      {p.is_voided && ` · ملغاة: ${p.void_reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-semibold tabular-nums", !p.is_voided && "text-success")}>{formatIQD(p.amount)}</span>
                    {p.is_voided && (
                      <Badge variant="secondary">{correctedBy.has(p.id) ? `صُحّحت بالوصل #${correctedBy.get(p.id)}` : "ملغاة"}</Badge>
                    )}
                    {isAdmin && !p.is_voided && (
                      <>
                        <CorrectPaymentButton id={p.id} subscriberId={sub.id} receiptNo={p.receipt_no} amount={p.amount} balance={sub.balance} />
                        <VoidButton kind="payment" id={p.id} subscriberId={sub.id} label={`الدفعة ${formatIQD(p.amount)} — وصل #${p.receipt_no}`} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
