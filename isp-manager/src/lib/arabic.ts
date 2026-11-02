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

/** 07701234567 → 9647701234567 (wa.me needs the international number). */
export function toWhatsAppNumber(phone: string) {
  const p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) return p.slice(1);
  if (p.startsWith("00")) return p.slice(2);
  if (p.startsWith("964")) return p;
  if (p.startsWith("0")) return "964" + p.slice(1);
  return p;
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

const n = new Intl.NumberFormat("en-US");

export function whatsappReminder(opts: {
  name: string;
  phone: string;
  endDate: string | null;
  expired: boolean;
  balance: number;
  formattedDate: string;
}) {
  let msg = `مرحباً ${opts.name}،\n`;
  if (opts.endDate) {
    msg += opts.expired
      ? `نود إعلامكم بأن اشتراك الإنترنت الخاص بكم انتهى بتاريخ ${opts.formattedDate}. يرجى التجديد لاستمرار الخدمة.`
      : `نود تذكيركم بأن اشتراك الإنترنت الخاص بكم ينتهي بتاريخ ${opts.formattedDate}.`;
  }
  if (opts.balance > 0) msg += `\nالمبلغ المتبقي بذمتكم: ${n.format(opts.balance)} دينار.`;
  msg += "\nشكراً لكم.";
  return `https://wa.me/${toWhatsAppNumber(opts.phone)}?text=${encodeURIComponent(msg)}`;
}
