"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { isMobileDevice, whatsAppChatUrl } from "@/lib/whatsapp";

/**
 * A subscriber phone number that opens their WhatsApp chat (no message is
 * pre-filled or sent). The server-rendered href is wa.me, which works
 * everywhere; on a computer the click is redirected to WhatsApp Web.
 * An invalid number is shown as plain text — never as a wrong link.
 */
export function WhatsAppPhone({ phone, className }: { phone: string | null | undefined; className?: string }) {
  if (!phone) return null;
  const href = whatsAppChatUrl(phone, "mobile");
  if (!href) {
    return (
      <span dir="ltr" className={className} title="رقم غير صالح لواتساب">
        {phone}
      </span>
    );
  }

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    e.stopPropagation();
    if (isMobileDevice(navigator.userAgent, navigator.maxTouchPoints)) return; // follow wa.me → app
    const web = whatsAppChatUrl(phone, "desktop");
    if (!web) return;
    e.preventDefault();
    window.open(web, "_blank", "noopener,noreferrer");
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      onClick={onClick}
      title="فتح محادثة واتساب"
      aria-label={`فتح محادثة واتساب مع ${phone}`}
      className={cn("text-primary underline-offset-2 hover:underline", className)}
    >
      {phone}
    </a>
  );
}
