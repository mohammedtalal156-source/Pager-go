/**
 * «رابط المشترك»: the private page a subscriber opens without logging in.
 */
import { toWhatsAppNumber } from "./whatsapp";

export const isLinkToken = (v: string) => /^[0-9a-f]{64}$/.test(v);

export function subscriberLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/s/${token}`;
}

/** The WhatsApp message sent with the link. */
export function linkMessage(name: string, endDate: string | null, url: string): string {
  const lines = [`مرحباً ${name}`];
  if (endDate) lines.push(`اشتراكك في الإنترنت ينتهي بتاريخ ${endDate}`);
  lines.push("تفاصيل اشتراكك ودينك من هذا الرابط:", url);
  return lines.join("\n");
}

/** wa.me link to the subscriber's chat with the message filled in; without a valid number WhatsApp asks for the contact. */
export function whatsAppShareUrl(phone: string | null | undefined, text: string): string {
  const n = toWhatsAppNumber(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}
