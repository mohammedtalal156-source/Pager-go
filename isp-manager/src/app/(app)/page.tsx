import Link from "next/link";
import {
  AlarmClock,
  Banknote,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  HandCoins,
  RadioTower,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatIQD } from "@/lib/utils";
import type { DashboardStats, SubscriptionStatus } from "@/lib/types";
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

export default async function DashboardPage() {
  const staff = await requireStaff();
  const supabase = await createClient();

  const [statsRes, renewalsRes, paymentsRes, expiringRes] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase
      .from("renewals")
      .select("id, created_at, new_end_date, price, amount_received, subscribers(full_name, code), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<RenewalRow[]>(),
    supabase
      .from("payments")
      .select("id, paid_at, amount, receipt_no, subscribers(full_name, code), profiles!payments_received_by_fkey(full_name)")
      .eq("is_voided", false)
      .order("paid_at", { ascending: false })
      .limit(10)
      .returns<PaymentRow[]>(),
    supabase
      .from("subscriber_overview")
      .select("id, code, full_name, phone, tower_name, end_date, days_left, status")
      .eq("is_archived", false)
      .eq("status", "expiring")
      .order("end_date", { ascending: true })
      .limit(10)
      .returns<ExpiringRow[]>(),
  ]);

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
      <PageHeader title={`أهلاً، ${staff.full_name}`} description={today} />
      {loadError && <Alert variant="destructive" className="mb-4">تعذر تحميل بعض البيانات: {loadError}</Alert>}

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="إجمالي المشتركين" value={n.format(s.total)} icon={Users} sub={s.no_subscription ? `${n.format(s.no_subscription)} بدون اشتراك` : undefined} />
          <StatCard label="المشتركين الفعالين" value={n.format(s.active)} icon={CircleCheck} tone="success" />
          <StatCard label="الاشتراكات المنتهية" value={n.format(s.expired)} icon={CalendarX2} tone="danger" />
          <StatCard label="تنتهي خلال 3 أيام" value={n.format(s.expiring)} icon={AlarmClock} tone="warning" />
          <StatCard label="عدد الأبراج" value={n.format(s.towers)} icon={RadioTower} href={staff.role !== "collector" ? "/towers" : undefined} />
          <StatCard label="المقبوضات اليوم" value={formatIQD(s.collected_today)} icon={Banknote} tone="success" />
          <StatCard label="المقبوضات هذا الشهر" value={formatIQD(s.collected_month)} icon={TrendingUp} tone="success" />
          <StatCard label="إجمالي الديون المستحقة" value={formatIQD(s.debt)} icon={HandCoins} tone="danger" sub={`${n.format(s.debtors)} مشترك مدين`} />
        </div>
      )}

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
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.tower_name} · {formatDate(r.end_date)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} daysLeft={r.days_left} />
                </div>
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
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatIQD(r.amount_received)}</span>
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

      {staff.role === "admin" && s && s.towers === 0 && (
        <Alert className="mt-6">
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
  );
}
