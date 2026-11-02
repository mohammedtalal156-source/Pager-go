/**
 * Helpers for the admin correction screens: manual date entry and a
 * readable form of the audit trail.
 */

const toLatin = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

function iso(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31/02 etc.
  return dt.toISOString().slice(0, 10);
}

/**
 * Typed date → YYYY-MM-DD, or null if it is not a real date.
 * Accepts 2026-12-01, 2026/12/1, 1/12/2026, 01-12-2026 (day first), Arabic digits.
 */
export function parseManualDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = toLatin(input).trim().replace(/[.\s]/g, "/").replace(/-/g, "/");
  let m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(v);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

/** Whole days from a to b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export type AuditRow = {
  id: number;
  occurred_at: string;
  actor_name: string | null;
  action: string;
  table_name: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
};

export type Lookups = { towers?: Record<string, string>; packages?: Record<string, string>; staff?: Record<string, string> };

export type HistoryItem = {
  id: number;
  at: string;
  who: string;
  title: string;
  tone: "info" | "money" | "danger" | "date";
  changes: { label: string; from: string; to: string }[];
  reason: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "الاسم",
  phone: "الهاتف",
  phone2: "الهاتف الثاني",
  tower_id: "البرج",
  area: "المنطقة",
  address: "العنوان",
  package_id: "الباقة",
  price: "سعر الاشتراك",
  collector_id: "الجابي",
  notes: "الملاحظات",
  start_date: "تاريخ البداية",
  end_date: "تاريخ الانتهاء",
  is_archived: "الأرشفة",
};

const n = new Intl.NumberFormat("en-US");
const money = (v: unknown) => `${n.format(Number(v ?? 0))} د.ع`;

function show(field: string, v: unknown, l: Lookups): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  if (field === "tower_id") return l.towers?.[s] ?? "برج آخر";
  if (field === "package_id") return l.packages?.[s] ?? "باقة أخرى";
  if (field === "collector_id") return l.staff?.[s] ?? "موظف";
  if (field === "price") return money(v);
  if (field === "is_archived") return v ? "مؤرشف" : "فعّال";
  return s;
}

/** Turns raw audit rows into readable items; pure balance recalculations are dropped. */
export function describeHistory(rows: AuditRow[], lookups: Lookups = {}): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const r of rows) {
    const o = r.old_data ?? {};
    const nw = r.new_data ?? {};
    const base = { id: r.id, at: r.occurred_at, who: r.actor_name ?? "النظام", reason: r.reason };

    if (r.table_name === "subscribers") {
      if (r.action === "INSERT") {
        out.push({ ...base, title: "إضافة المشترك", tone: "info", changes: [] });
        continue;
      }
      const changes = Object.keys(FIELD_LABELS)
        .filter((f) => JSON.stringify(o[f] ?? null) !== JSON.stringify(nw[f] ?? null))
        .map((f) => ({ label: FIELD_LABELS[f], from: show(f, o[f], lookups), to: show(f, nw[f], lookups) }));
      if (changes.length === 0) continue; // balance recalculation only
      const datesOnly = changes.every((c) => c.label === FIELD_LABELS.start_date || c.label === FIELD_LABELS.end_date);
      // Date moves caused by renewals are already shown by the renewal row.
      if (datesOnly && r.reason === "تجديد اشتراك") continue;
      out.push({ ...base, title: datesOnly ? "تعديل تواريخ الاشتراك" : "تعديل بيانات المشترك", tone: datesOnly ? "date" : "info", changes });
      continue;
    }

    if (r.table_name === "payments") {
      const receipt = `وصل #${nw.receipt_no ?? o.receipt_no}`;
      if (r.action === "INSERT") {
        out.push({
          ...base,
          title: nw.corrects_payment_id ? `دفعة مصحّحة (${receipt}): ${money(nw.amount)}` : `دفعة (${receipt}): ${money(nw.amount)}`,
          tone: "money",
          changes: [],
        });
      } else if (nw.is_voided && !o.is_voided) {
        out.push({ ...base, title: `إلغاء ${receipt} (${money(o.amount)})`, tone: "danger", changes: [], reason: r.reason ?? (nw.void_reason as string) ?? null });
      }
      continue;
    }

    if (r.table_name === "subscriptions") {
      if (r.action === "INSERT") {
        out.push({ ...base, title: `فترة اشتراك ${nw.start_date} ← ${nw.end_date} (${money(nw.price)})`, tone: "date", changes: [] });
      } else if (nw.is_voided && !o.is_voided) {
        out.push({ ...base, title: `إلغاء فترة ${o.start_date} ← ${o.end_date}`, tone: "danger", changes: [], reason: r.reason ?? (nw.void_reason as string) ?? null });
      }
      continue;
    }

    if (r.table_name === "debt_adjustments" && r.action === "INSERT") {
      const amt = Number(nw.amount ?? 0);
      out.push({
        ...base,
        title: `تعديل الدين: ${money(nw.previous_balance)} ← ${money(nw.new_balance)} (${amt > 0 ? "+" : "−"}${money(Math.abs(amt))})`,
        tone: "money",
        changes: [],
        reason: (nw.reason as string) ?? r.reason,
      });
      continue;
    }

    if (r.table_name === "renewals" && r.action === "INSERT") {
      out.push({ ...base, title: `تجديد حتى ${nw.new_end_date} (المستلم ${money(nw.amount_received)})`, tone: "date", changes: [] });
    }
  }
  return out;
}
