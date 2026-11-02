import { addDays, todayBaghdad } from "@/lib/arabic";

export type PeriodPreset = "today" | "yesterday" | "week" | "month" | "last_month" | "year" | "custom";

export const PRESET_LABELS: Record<Exclude<PeriodPreset, "custom">, string> = {
  today: "اليوم",
  yesterday: "أمس",
  week: "آخر 7 أيام",
  month: "هذا الشهر",
  last_month: "الشهر الماضي",
  year: "هذه السنة",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Resolves ?p=&from=&to= into a concrete [from, to] range (Asia/Baghdad days). */
export function resolvePeriod(sp: { p?: string; from?: string; to?: string }, fallback: PeriodPreset = "month") {
  const today = todayBaghdad();
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const preset = (sp.p as PeriodPreset) || (sp.from || sp.to ? "custom" : fallback);
  let from = today;
  let to = today;
  switch (preset) {
    case "yesterday":
      from = to = addDays(today, -1);
      break;
    case "week":
      from = addDays(today, -6);
      break;
    case "month":
      from = monthStart;
      break;
    case "last_month": {
      const lastEnd = addDays(monthStart, -1);
      from = lastEnd.slice(0, 8) + "01";
      to = lastEnd;
      break;
    }
    case "year":
      from = `${y}-01-01`;
      break;
    case "custom":
      from = sp.from && ISO.test(sp.from) ? sp.from : monthStart;
      to = sp.to && ISO.test(sp.to) ? sp.to : today;
      break;
  }
  if (from > to) [from, to] = [to, from];
  // Keep ranges bounded (≈ 13 months).
  if (addDays(from, 400) < to) from = addDays(to, -400);
  return { preset, from, to };
}
