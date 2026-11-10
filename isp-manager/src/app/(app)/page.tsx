import Link from "next/link";
import {
  AlarmClock,
  ArrowRightLeft,
  Banknote,
  BellRing,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  HandCoins,
  RadioTower,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatIQD } from "@/lib/utils";
import { can, type DashboardStats, type SubscriptionStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

type RenewalRow = {
  id: string;
  created_at: string;
  new_end_date: string;
  price: number;
  amount_received: number;
  subscriptions: { payments: { amount: number; is_voided: boolean }[] } | null;
  subscribers: { full_name: string; code: number } | null;
  profiles: { full_name: string } | null;
};
type PaymentRow = {
  id: string;
  paid_at: string;
  amount: number;
  receipt_no: number;
  subscribers: { full_name: string; code: number } | null;
  profiles: { full_name: string } | null;
};
type ExpiringRow = {
  id: string;
  code: number;
  full_name: string;
  phone: string;
  tower_name: string;
  end_date: string;
  days_left: number;
  status: SubscriptionStatus;
};

const n = new Intl.NumberFormat("en-US");

type TowerItem = { id: string; name: string; area: string | null };
type TowerNumbers = { tower_id: string; subscribers: number; active: number; expiring: number; expired: number; debt: number; collected_month: number };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tower?: string }> }) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: towerList, error: towersError } = await supabase
    .from("towers")
    .select("id, name, area")
    .eq("is_archived", false)
    .order("name")
    .returns<TowerItem[]>();
  const towers = towerList ?? [];
  const picked = sp.tower && z.uuid().safeParse(sp.tower).success ? towers.find((t) => t.id === sp.tower) : undefined;
  // One tower only: open it directly.
  const tower = picked ?? (towers.length === 1 ? towers[0] : undefined);

  if (!tower) return <TowerPicker staff={staff} towers={towers} error={towersError?.message} />;

  const countDays = (d: number) =>
    supabase
      .from("subscriber_overview")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .eq("tower_id", tower.id)
      .eq("days_left", d);
  const [statsRes, renewalsRes, paymentsRes, expiringRes, todayRes, tomorrowRes] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_tower_id: tower.id }),
    supabase
      .from("renewals")
      .select(
        "id, created_at, new_end_date, price, amount_received, subscriptions!inner(tower_id, payments(amount, is_voided)), subscribers(full_name, code), profiles(full_name)",
      )
      .eq("subscriptions.tower_id", tower.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<RenewalRow[]>(),
    supabase
      .from("payments")
      .select("id, paid_at, amount, receipt_no, subscribers(full_name, code), profiles!payments_received_by_fkey(full_name)")
      .eq("is_voided", false)
      .eq("tower_id", tower.id)
      .order("paid_at", { ascending: false })
      .limit(10)
      .returns<PaymentRow[]>(),
    supabase
      .from("subscriber_overview")
      .select("id, code, full_name, phone, tower_name, end_date, days_left, status")
      .eq("is_archived", false)
      .eq("tower_id", tower.id)
      .eq("status", "expiring")
      .order("end_date", { ascending: true })
      .limit(10)
      .returns<ExpiringRow[]>(),
    countDays(0),
    countDays(1),
  ]);
  const t = `&tower=${tower.id}`;

  const s = (statsRes.data ?? null) as DashboardStats | null;
  const loadError = statsRes.error?.message ?? renewalsRes.error?.message ?? paymentsRes.error?.message ?? expiringRes.error?.message;
  const today = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
    timeZone: "Asia/Baghdad",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <>
      <PageHeader
        title={tower.name}
        description={`${today}${tower.area ? ` · ${tower.area}` : ""}`}
        actions={
          towers.length > 1 ? (
            <Button asChild variant="outline" className="h-11">
              <Link href="/">
                <ArrowRightLeft /> تغيير البرج
              </Link>
            </Button>
          ) : undefined
        }
      />
      {loadError && <Alert variant="destructive" className="mb-4">تعذر تحميل بعض البيانات: {loadError}</Alert>}

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="إجمالي المشتركين" value={n.format(s.total)} icon={Users} href={`/subscribers?tower=${tower.id}`} sub={s.no_subscription ? `${n.format(s.no_subscription)} غير فعّال` : undefined} />
          <StatCard label="المشتركين الفعالين" value={n.format(s.active)} icon={CircleCheck} tone="success" href={`/subscribers?status=active${t}`} />
          <StatCard label="الاشتراكات المنتهية" value={n.format(s.expired)} icon={CalendarX2} tone="danger" href={`/subscribers?status=expired${t}`} />
          <StatCard label="تنتهي خلال 3 أيام" value={n.format(s.expiring)} icon={AlarmClock} tone="warning" href={`/subscribers?status=expiring${t}`} />
          <StatCard label="البرج" value={tower.name} icon={RadioTower} href={staff.role !== "collector" ? `/towers/${tower.id}` : undefined} />
          <StatCard label="المقبوضات اليوم" value={formatIQD(s.collected_today)} icon={Banknote} tone="success" />
          <StatCard label="المقبوضات هذا الشهر" value={formatIQD(s.collected_month)} icon={TrendingUp} tone="success" />
          <StatCard label="إجمالي الديون المستحقة" value={formatIQD(s.debt)} icon={HandCoins} tone="danger" sub={`${n.format(s.debtors)} مشترك مدين`} href={`/subscribers?status=debt${t}`} />
        </div>
      )}

      {s && (
        <Card className="mt-4 gap-2 py-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="size-4 text-warning" /> التنبيهات
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[
              { label: "تنتهي اليوم", n: todayRes.count ?? 0, href: `/subscribers?status=today${t}`, cls: "border-danger/40 text-danger" },
              { label: "تنتهي غداً", n: tomorrowRes.count ?? 0, href: `/subscribers?status=tomorrow${t}`, cls: "border-warning/50 text-warning" },
              { label: "خلال 3 أيام", n: s.expiring, href: `/subscribers?status=expiring${t}`, cls: "border-warning/50 text-warning" },
              { label: "منتهية", n: s.expired, href: `/subscribers?status=expired${t}`, cls: "border-danger/40 text-danger" },
              { label: "عليهم ديون", n: s.debtors, href: `/subscribers?status=debt${t}`, cls: "border-danger/40 text-danger" },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-accent ${a.n > 0 ? a.cls : "text-muted-foreground"}`}
              >
                {a.label}
                <b className="tabular-nums">{n.format(a.n)}</b>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {can(staff, "create_subscribers") && (
          <Button asChild size="lg" className="h-16 flex-col gap-1 text-xs sm:flex-row sm:text-sm">
            <Link href="/subscribers?new=1">
              <UserPlus /> إضافة مشترك
            </Link>
          </Button>
        )}
        {can(staff, "renew") && (
          <Button asChild size="lg" variant="outline" className="h-16 flex-col gap-1 text-xs sm:flex-row sm:text-sm">
            <Link href={`/subscribers?tower=${tower.id}`}>
              <RefreshCw /> تجديد اشتراك
            </Link>
          </Button>
        )}
        {can(staff, "collect") && (
          <Button asChild size="lg" variant="outline" className="h-16 flex-col gap-1 text-xs sm:flex-row sm:text-sm">
            <Link href={`/subscribers?status=debt${t}`}>
              <Banknote /> تسجيل دفعة
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-warning" /> قريبة من الانتهاء
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(expiringRes.data ?? []).length === 0 ? (
              <EmptyState icon={CalendarClock} title="لا توجد اشتراكات تنتهي خلال 3 أيام" />
            ) : (
              expiringRes.data!.map((r) => (
                <Link key={r.id} href={`/subscribers/${r.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 hover:bg-accent/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.tower_name} · {formatDate(r.end_date)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} daysLeft={r.days_left} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="size-4 text-primary" /> آخر التجديدات
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(renewalsRes.data ?? []).length === 0 ? (
              <EmptyState icon={RefreshCw} title="لا توجد تجديدات بعد" />
            ) : (
              renewalsRes.data!.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.subscribers?.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      حتى {formatDate(r.new_end_date)} · {r.profiles?.full_name ?? ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {/* live payments of this period, so corrected amounts show correctly */}
                    {formatIQD(r.subscriptions ? r.subscriptions.payments.filter((p) => !p.is_voided).reduce((a, p) => a + p.amount, 0) : r.amount_received)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="size-4 text-success" /> آخر عمليات التحصيل
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(paymentsRes.data ?? []).length === 0 ? (
              <EmptyState icon={Banknote} title="لا توجد دفعات مسجلة بعد" />
            ) : (
              paymentsRes.data!.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.subscribers?.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateTime(p.paid_at)} · {p.profiles?.full_name ?? ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-success tabular-nums">{formatIQD(p.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** First screen of the home page: choose which tower's numbers to see. */
async function TowerPicker({ staff, towers, error }: { staff: { full_name: string; role: string }; towers: TowerItem[]; error?: string }) {
  const supabase = await createClient();
  const { data } = towers.length ? await supabase.rpc("tower_stats") : { data: [] };
  const byId = new Map(((data ?? []) as TowerNumbers[]).map((r) => [r.tower_id, r]));
  return (
    <>
      <PageHeader title={`أهلاً، ${staff.full_name}`} description="اختر البرج لعرض إحصائياته" />
      {error && <Alert variant="destructive" className="mb-4">تعذر تحميل الأبراج: {error}</Alert>}
      {towers.length === 0 ? (
        <>
          <EmptyState icon={RadioTower} title="لا توجد أبراج بعد" />
          {staff.role === "admin" && (
            <Alert className="mt-4">
              <RadioTower />
              <div>
                ابدأ بإضافة الأبراج والباقات:{" "}
                <Link href="/towers" className="font-medium text-primary underline">
                  الأبراج
                </Link>{" "}
                ·{" "}
                <Link href="/packages" className="font-medium text-primary underline">
                  الباقات
                </Link>
              </div>
            </Alert>
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {towers.map((tw) => {
            const r = byId.get(tw.id);
            return (
              <Link
                key={tw.id}
                href={`/?tower=${tw.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <RadioTower className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{tw.name}</p>
                  {tw.area && <p className="truncate text-xs text-muted-foreground">{tw.area}</p>}
                  {r && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <b className="tabular-nums text-foreground">{n.format(r.subscribers)}</b> مشترك ·{" "}
                      <span className="text-success">{n.format(r.active)} فعال</span>
                      {r.debt > 0 && <span className="text-danger"> · دين {formatIQD(r.debt)}</span>}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
