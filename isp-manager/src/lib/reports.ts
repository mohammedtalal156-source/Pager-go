import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/utils";

export type ReportKey = "daily" | "monthly" | "debts" | "expired" | "towers" | "collectors";

export const REPORTS: { key: ReportKey; label: string; usesPeriod: boolean }[] = [
  { key: "daily", label: "المقبوضات اليومية", usesPeriod: true },
  { key: "monthly", label: "المقبوضات الشهرية", usesPeriod: true },
  { key: "debts", label: "الديون", usesPeriod: false },
  { key: "expired", label: "الاشتراكات المنتهية", usesPeriod: false },
  { key: "towers", label: "أداء الأبراج", usesPeriod: true },
  { key: "collectors", label: "تحصيل الموظفين", usesPeriod: true },
];

export type Column = { key: string; label: string; type?: "money" | "date" | "number" | "text" };
export type Report = { title: string; columns: Column[]; rows: Record<string, string | number | null>[]; totals?: Record<string, number> };

type Daily = { date: string; collected: number; expenses: number };

const MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

function sum(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

export async function buildReport(
  supabase: SupabaseClient,
  key: ReportKey,
  range: { from: string; to: string },
  towerId: string | null,
): Promise<Report> {
  switch (key) {
    case "daily":
    case "monthly": {
      const { data, error } = await supabase.rpc("finance_summary", { p_from: range.from, p_to: range.to, p_tower_id: towerId });
      if (error) throw new Error(error.message);
      const daily = ((data as { daily: Daily[] }).daily ?? []).map((d) => ({ ...d, net: d.collected - d.expenses }));
      let rows: Record<string, string | number | null>[];
      if (key === "daily") {
        rows = daily.filter((d) => d.collected || d.expenses).map((d) => ({ date: d.date, collected: d.collected, expenses: d.expenses, net: d.net }));
      } else {
        const byMonth = new Map<string, { collected: number; expenses: number }>();
        for (const d of daily) {
          const m = d.date.slice(0, 7);
          const cur = byMonth.get(m) ?? { collected: 0, expenses: 0 };
          cur.collected += d.collected;
          cur.expenses += d.expenses;
          byMonth.set(m, cur);
        }
        rows = [...byMonth.entries()].map(([m, v]) => ({
          month: `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`,
          collected: v.collected,
          expenses: v.expenses,
          net: v.collected - v.expenses,
        }));
      }
      const first = key === "daily" ? { key: "date", label: "التاريخ", type: "date" as const } : { key: "month", label: "الشهر", type: "text" as const };
      return {
        title: key === "daily" ? "المقبوضات اليومية" : "المقبوضات الشهرية",
        columns: [first, { key: "collected", label: "المقبوضات", type: "money" }, { key: "expenses", label: "المصروفات", type: "money" }, { key: "net", label: "الصافي", type: "money" }],
        rows,
        totals: { collected: sum(rows, "collected"), expenses: sum(rows, "expenses"), net: sum(rows, "net") },
      };
    }
    case "debts":
    case "expired": {
      let q = supabase
        .from("subscriber_overview")
        .select("code, full_name, tower_name, phone, end_date, days_left, balance")
        .eq("is_archived", false);
      if (towerId) q = q.eq("tower_id", towerId);
      q = key === "debts" ? q.gt("balance", 0).order("balance", { ascending: false }) : q.eq("status", "expired").order("end_date", { ascending: true });
      const { data, error } = await q.limit(5000);
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map((r) => ({
        code: r.code,
        full_name: r.full_name,
        tower_name: r.tower_name,
        phone: r.phone,
        end_date: r.end_date,
        days: r.days_left == null ? null : key === "expired" ? -r.days_left : r.days_left,
        balance: r.balance,
      }));
      return {
        title: key === "debts" ? "تقرير الديون" : "تقرير الاشتراكات المنتهية",
        columns: [
          { key: "code", label: "رقم المشترك", type: "number" },
          { key: "full_name", label: "الاسم" },
          { key: "tower_name", label: "البرج" },
          { key: "phone", label: "الهاتف" },
          { key: "end_date", label: "انتهاء الاشتراك", type: "date" },
          { key: "days", label: key === "expired" ? "أيام منذ الانتهاء" : "الأيام المتبقية", type: "number" },
          { key: "balance", label: "المبلغ المتبقي", type: "money" },
        ],
        rows,
        totals: { balance: sum(rows, "balance") },
      };
    }
    case "towers": {
      const { data, error } = await supabase.rpc("report_towers", { p_from: range.from, p_to: range.to });
      if (error) throw new Error(error.message);
      const rows = ((data ?? []) as Record<string, string | number | null>[]).filter((r) => !towerId || r.tower_id === towerId);
      return {
        title: "أداء الأبراج",
        columns: [
          { key: "tower_name", label: "البرج" },
          { key: "subscribers", label: "المشتركين", type: "number" },
          { key: "active", label: "فعال", type: "number" },
          { key: "expired", label: "منتهي", type: "number" },
          { key: "new_subscribers", label: "جدد", type: "number" },
          { key: "renewals", label: "تجديدات", type: "number" },
          { key: "collected", label: "المقبوضات", type: "money" },
          { key: "expenses", label: "المصروفات", type: "money" },
          { key: "net", label: "الصافي", type: "money" },
          { key: "debt", label: "الديون", type: "money" },
        ],
        rows,
        totals: { collected: sum(rows, "collected"), expenses: sum(rows, "expenses"), net: sum(rows, "net"), debt: sum(rows, "debt") },
      };
    }
    case "collectors": {
      const { data, error } = await supabase.rpc("report_collectors", { p_from: range.from, p_to: range.to, p_tower_id: towerId });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, string | number | null>[];
      return {
        title: "تحصيل الموظفين",
        columns: [
          { key: "staff_name", label: "الموظف" },
          { key: "payments", label: "عدد الدفعات", type: "number" },
          { key: "renewals", label: "منها تجديدات", type: "number" },
          { key: "collected", label: "المبلغ المحصل", type: "money" },
        ],
        rows,
        totals: { collected: sum(rows, "collected") },
      };
    }
  }
}

export function displayCell(value: string | number | null | undefined, type?: Column["type"]) {
  if (value == null || value === "") return "—";
  if (type === "money") return `${new Intl.NumberFormat("en-US").format(Number(value))} د.ع`;
  if (type === "number") return new Intl.NumberFormat("en-US").format(Number(value));
  if (type === "date") return formatDate(String(value));
  return String(value);
}
