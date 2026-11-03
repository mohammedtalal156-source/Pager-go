import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarRange, RadioTower, Receipt, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isLinkToken } from "@/lib/subscriber-link";
import { formatDate, formatIQD } from "@/lib/utils";
import type { SubscriptionStatus } from "@/lib/types";
import { StatusBadge } from "@/components/app/status-badge";
import { ThemeToggle } from "@/components/app/theme-toggle";

export const metadata: Metadata = {
  title: "اشتراكي",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type View = {
  full_name: string;
  code: number;
  package_name: string | null;
  price: number;
  start_date: string | null;
  end_date: string | null;
  days_left: number | null;
  status: SubscriptionStatus;
  balance: number;
  tower_name: string;
  payments: { receipt_no: number; amount: number; paid_at: string }[];
};

export default async function SubscriberPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isLinkToken(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("subscriber_public_view", { p_token: token });
  const v = data as View | null;
  if (!v) notFound();

  const left =
    v.days_left == null ? null : v.days_left < 0 ? `منتهي منذ ${-v.days_left} يوم` : v.days_left === 0 ? "ينتهي اليوم" : `باقي ${v.days_left} يوم`;

  return (
    <main className="relative min-h-dvh bg-gradient-to-b from-primary/10 via-background to-background px-4 py-8">
      <ThemeToggle className="absolute top-4 left-4" />
      <div className="mx-auto grid w-full max-w-md gap-3">
        <div className="mb-2 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <RadioTower className="size-6" />
          </div>
          <h1 className="text-xl font-bold">{v.full_name}</h1>
          <p className="text-sm text-muted-foreground">رقم المشترك #{v.code}</p>
          <StatusBadge status={v.status} daysLeft={v.days_left} />
        </div>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <CalendarRange className="size-4 text-primary" /> الاشتراك
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">الباقة</dt>
              <dd className="font-medium">{v.package_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">السعر</dt>
              <dd className="font-medium">{formatIQD(v.price)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">من</dt>
              <dd className="font-medium">{formatDate(v.start_date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ينتهي</dt>
              <dd className="font-medium">{formatDate(v.end_date)}</dd>
            </div>
          </dl>
          {left && <p className={`mt-3 text-center text-sm font-semibold ${v.days_left! < 0 ? "text-danger" : "text-primary"}`}>{left}</p>}
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Wallet className="size-4 text-primary" /> الدين
          </h2>
          <p className={`text-2xl font-bold tabular-nums ${v.balance > 0 ? "text-danger" : "text-success"}`}>
            {v.balance > 0 ? formatIQD(v.balance) : "لا يوجد دين"}
          </p>
        </section>

        {v.payments.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <Receipt className="size-4 text-primary" /> آخر الدفعات
            </h2>
            <ul className="divide-y text-sm">
              {v.payments.map((p) => (
                <li key={p.receipt_no} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">
                    {formatDate(p.paid_at)} · وصل #{p.receipt_no}
                  </span>
                  <span className="font-semibold tabular-nums">{formatIQD(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-2 text-center text-xs text-muted-foreground">{v.tower_name}</p>
      </div>
    </main>
  );
}
