import type { Metadata } from "next";
import { Banknote, HandCoins, Receipt, Scale } from "lucide-react";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/period";
import { requireCurrentTower } from "@/lib/current-tower-server";
import { cn, formatDate, formatIQD } from "@/lib/utils";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/validation/expense";
import { PageHeader } from "@/components/app/page-header";
import { PeriodFilter } from "@/components/app/period-filter";
import { StatCard } from "@/components/app/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddExpenseButton, VoidExpenseButton } from "./expense-controls";

export const metadata: Metadata = { title: "الحسابات" };

type Summary = {
  collected: number;
  payments_count: number;
  collected_by_kind: Partial<Record<"new_subscription" | "renewal" | "collection", number>>;
  expenses: number;
  expenses_by_category: Partial<Record<ExpenseCategory, number>>;
  net: number;
  debt: number;
  daily: { date: string; collected: number; expenses: number }[];
};
type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  description: string | null;
  is_voided: boolean;
  void_reason: string | null;
  towers: { name: string } | null;
  profiles: { full_name: string } | null;
};

const KIND_LABELS = { new_subscription: "اشتراكات جديدة", renewal: "تجديدات", collection: "تحصيل ديون" } as const;

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string; tower?: string }> }) {
  const staff = await requireSection("finance");
  const sp = await searchParams;
  const { preset, from, to } = resolvePeriod(sp, "month");
  const supabase = await createClient();
  const { tower: current } = await requireCurrentTower(supabase, sp.tower);
  const tower = current?.id ?? null;

  let expQ = supabase
    .from("expenses")
    .select("id, category, amount, expense_date, description, is_voided, void_reason, towers(name), profiles!expenses_created_by_fkey(full_name)")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .limit(200);
  if (tower) expQ = expQ.eq("tower_id", tower);

  const [sumRes, expRes] = await Promise.all([
    supabase.rpc("finance_summary", { p_from: from, p_to: to, p_tower_id: tower }),
    expQ.returns<ExpenseRow[]>(),
  ]);
  const s = sumRes.data as Summary | null;
  const towers = current ? [{ id: current.id, name: current.name }] : [];
  const activeDays = (s?.daily ?? []).filter((d) => d.collected || d.expenses).reverse();
  const isAdmin = staff.role === "admin";

  return (
    <>
      <PageHeader
        title="الحسابات"
        description={`${formatDate(from)} — ${formatDate(to)}${tower ? ` · ${towers.find((t) => t.id === tower)?.name ?? ""}` : ""}`}
        actions={isAdmin && <AddExpenseButton towers={towers} defaultTowerId={tower ?? undefined} />}
      />
      <PeriodFilter preset={preset} from={from} to={to} towers={[]} />
      {(sumRes.error || expRes.error) && <Alert variant="destructive" className="mb-4">{sumRes.error?.message ?? expRes.error?.message}</Alert>}
      {tower && <p className="mb-3 text-xs text-muted-foreground">عند اختيار برج، تُحتسب مصروفات هذا البرج فقط (لا تدخل المصروفات العامة).</p>}

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="المقبوضات (نقد فعلي)" value={formatIQD(s.collected)} icon={Banknote} tone="success" sub={`${s.payments_count} دفعة`} />
            <StatCard label="المصروفات" value={formatIQD(s.expenses)} icon={Receipt} tone="warning" />
            <StatCard label="صافي التدفق النقدي" value={formatIQD(s.net)} icon={Scale} tone={s.net >= 0 ? "success" : "danger"} />
            <StatCard label="الديون الحالية (غير محصلة)" value={formatIQD(s.debt)} icon={HandCoins} tone="danger" href="/subscribers?status=debt" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">مصادر المقبوضات</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <div key={k} className="flex justify-between">
                    <span>{label}</span>
                    <b className="tabular-nums">{formatIQD(s.collected_by_kind[k as keyof typeof KIND_LABELS] ?? 0)}</b>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">المصروفات حسب التصنيف</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {Object.entries(EXPENSE_CATEGORIES).map(([k, label]) => (
                  <div key={k} className="flex justify-between">
                    <span>{label}</span>
                    <b className="tabular-nums">{formatIQD(s.expenses_by_category[k as ExpenseCategory] ?? 0)}</b>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4 gap-3">
            <CardHeader>
              <CardTitle className="text-base">الحركة اليومية</CardTitle>
            </CardHeader>
            <CardContent>
              {activeDays.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد حركات في هذه الفترة.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="p-2 text-start font-medium">التاريخ</th>
                        <th className="p-2 text-start font-medium">المقبوضات</th>
                        <th className="p-2 text-start font-medium">المصروفات</th>
                        <th className="p-2 text-start font-medium">الصافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activeDays.map((d) => (
                        <tr key={d.date}>
                          <td className="p-2">{formatDate(d.date)}</td>
                          <td className="p-2 text-success tabular-nums">{formatIQD(d.collected)}</td>
                          <td className="p-2 tabular-nums">{formatIQD(d.expenses)}</td>
                          <td className={cn("p-2 font-semibold tabular-nums", d.collected - d.expenses < 0 && "text-danger")}>{formatIQD(d.collected - d.expenses)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="mt-4 gap-3">
        <CardHeader>
          <CardTitle className="text-base">المصروفات المسجلة</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(expRes.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد مصروفات في هذه الفترة.</p>}
          {(expRes.data ?? []).map((e) => (
            <div key={e.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm", e.is_voided && "opacity-50")}>
              <div>
                <p className="font-medium">
                  {EXPENSE_CATEGORIES[e.category]} · {formatDate(e.expense_date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.towers?.name ?? "عام"}
                  {e.description && ` · ${e.description}`} · {e.profiles?.full_name ?? ""}
                  {e.is_voided && ` · ملغى: ${e.void_reason}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <b className="tabular-nums">{formatIQD(e.amount)}</b>
                {e.is_voided && <Badge variant="secondary">ملغى</Badge>}
                {isAdmin && !e.is_voided && <VoidExpenseButton id={e.id} label={`${EXPENSE_CATEGORIES[e.category]} ${formatIQD(e.amount)}`} />}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
