import { toWhatsAppNumber } from "./whatsapp";

/**
 * Mirror of public.normalize_ar() in the database, so what the user types
 * matches subscribers.search_text (أ/إ/آ → ا, ة → ه, ى → ي, no harakat,
 * Arabic-Indic digits → 0-9).
 */
export function normalizeAr(input: string) {
  return input
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .trim();
}

/** Search term safe for an ILIKE pattern; phone-like input loses spaces/dashes. */
export function searchTerm(q: string) {
  let t = normalizeAr(q).replace(/[%_\\*(),]/g, " ").replace(/\s+/g, " ").trim();
  if (/^[\d\s+-]+$/.test(t)) t = t.replace(/[\s-]/g, "");
  return t;
}

/**
 * Phones are stored as 07…, 9647… or +9647…. Searching by the part after the
 * country code / leading zero finds the number in every format.
 */
export function phoneCore(digits: string) {
  let d = digits.replace(/^\+/, "");
  if (d.startsWith("00964")) d = d.slice(5);
  else if (d.startsWith("964")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.length >= 3 ? d : digits.replace(/^\+/, "");
}

/**
 * Words to match (each must appear, in any order). «علي عامود» finds
 * «ابا الحسن علي عامود 47»; «07807444064» finds «9647807444064».
 */
export function searchWords(q: string): string[] {
  const t = searchTerm(q);
  if (!t) return [];
  if (/^\+?\d+$/.test(t)) return [phoneCore(t)];
  return [...new Set(t.split(" ").filter(Boolean).map((w) => (/^\+?\d{4,}$/.test(w) ? phoneCore(w) : w)))];
}


/** Business "today" in Asia/Baghdad as YYYY-MM-DD. */
export function todayBaghdad() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Same day n months later; a missing day becomes the month's last day (31/01 → 28/02), like the database. */
export function addMonths(isoDate: string, months: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/**
 * End of a subscription period from `base`: `days` later, or for towers with
 * calendar-month periods the same day `round(days / 30)` months later (11/11 → 11/12).
 */
export function periodEnd(base: string, days: number, monthly: boolean) {
  return monthly ? addMonths(base, Math.max(1, Math.round(days / 30))) : addDays(base, days);
}

/** Office name and e-payment numbers printed at the end of every reminder. */
export const REMINDER_FOOTER = [
  "مكتب الرؤيا",
  "",
  "يتوفر الدفع الالكتروني عن طريق",
  " الماستر : 7119171481 ",
  "او الزين كاش : 07704593597",
  "",
  "مع الشكر والتقدير",
].join("\n");

/** WhatsApp reminder in the office template (end date, activation date, payment numbers). */
export function whatsappReminder(opts: {
  name: string;
  phone: string;
  endDate: string | null;
  expired: boolean;
  formattedDate: string;
  /** Activation (start) date, already formatted. */
  formattedStart?: string | null;
}) {
  const lines = [`مرحباً ${opts.name}`];
  if (opts.endDate) {
    lines.push(
      opts.expired
        ? `نود إعلامكم بأن اشتراك الإنترنت الخاص بكم انتهى بتاريخ ${opts.formattedDate}.`
        : `نود تذكيركم بأن اشتراك الإنترنت الخاص بكم ينتهي بتاريخ ${opts.formattedDate}.`,
    );
  }
  if (opts.formattedStart) lines.push(`علماً ان تاريخ التفعيل هو ${opts.formattedStart}`);
  const msg = `${lines.join("\n")}\n${REMINDER_FOOTER}`;
  const number = toWhatsAppNumber(opts.phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(msg)}` : null;
}
