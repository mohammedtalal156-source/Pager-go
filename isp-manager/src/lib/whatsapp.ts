/**
 * WhatsApp chat links for subscriber phone numbers.
 *
 * Numbers are stored as typed (usually 07XXXXXXXXX). WhatsApp needs the
 * international number without "+" or leading zeros, e.g. 9647701234567.
 * Anything we cannot turn into a valid number returns null, so the UI never
 * renders a link that would open the wrong chat.
 */

const toLatinDigits = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Iraqi mobile in international form: 964 + 7 + 9 digits. */
const IRAQ_MOBILE = /^9647\d{9}$/;
/** Any other country (E.164: 8–15 digits, no leading zero). */
const INTERNATIONAL = /^[1-9]\d{7,14}$/;

/**
 * 07701234567 → 9647701234567
 * 9647701234567 / +9647701234567 / 009647701234567 → 9647701234567
 * 7701234567 → 9647701234567
 * Invalid input → null.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const raw = toLatinDigits(phone).trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(raw)) return null;

  let intl: boolean;
  let digits: string;
  if (raw.startsWith("+")) {
    intl = true;
    digits = raw.slice(1);
  } else if (raw.startsWith("00")) {
    intl = true;
    digits = raw.slice(2);
  } else {
    intl = false;
    digits = raw;
  }

  if (digits.startsWith("964")) {
    // 96407701234567 (local zero kept after the country code) → drop the zero
    if (/^96407\d{9}$/.test(digits)) digits = "964" + digits.slice(4);
    return IRAQ_MOBILE.test(digits) ? digits : null;
  }
  if (intl) return INTERNATIONAL.test(digits) ? digits : null;

  // Local Iraqi formats
  if (/^07\d{9}$/.test(digits)) return "964" + digits.slice(1);
  if (/^7\d{9}$/.test(digits)) return "964" + digits;
  return null;
}

/** True for phones/tablets (incl. iPadOS, which reports itself as a Mac). */
export function isMobileDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/**
 * Link that opens the chat with no pre-filled message.
 * Phones: wa.me (universal link → WhatsApp app). Computers: WhatsApp Web.
 */
export function whatsAppChatUrl(phone: string | null | undefined, device: "mobile" | "desktop" = "mobile"): string | null {
  const n = toWhatsAppNumber(phone);
  if (!n) return null;
  return device === "desktop" ? `https://web.whatsapp.com/send?phone=${n}` : `https://wa.me/${n}`;
}
