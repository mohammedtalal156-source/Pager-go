"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * «تم التجديد» window with the WhatsApp button. It lives at the app root, so it
 * stays open even when the renewed subscriber leaves the filtered list
 * (e.g. «منتهي» / «تنتهي اليوم») and its row disappears.
 */
export type RenewalNoticeData = { name: string; endText: string; balanceText: string; wa: string | null };

let current: RenewalNoticeData | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function showRenewalNotice(data: RenewalNoticeData) {
  current = data;
  emit();
}

function closeNotice() {
  current = null;
  emit();
}

export function RenewalNotice() {
  const n = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <Dialog open={n !== null} onOpenChange={(o) => !o && closeNotice()}>
      <DialogContent>
        {n && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2">
                <CheckCircle2 className="size-6 text-success" /> تم التجديد
              </DialogTitle>
              <DialogDescription className="text-center">{n.name}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 text-center">
              <p className="text-lg font-bold">ينتهي بتاريخ {n.endText}</p>
              <p className="text-sm text-muted-foreground">{n.balanceText}</p>
              {n.wa ? (
                <Button asChild size="lg" className="h-14 bg-[#25D366] text-lg text-white hover:bg-[#1ebe5b]">
                  <a href={n.wa} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(closeNotice, 300)}>
                    <MessageCircle /> إرسال رسالة التجديد بالواتساب
                  </a>
                </Button>
              ) : (
                <Alert variant="warning">رقم المشترك غير صالح للواتساب، لا يمكن إرسال الرسالة.</Alert>
              )}
              <Button variant="outline" size="lg" onClick={closeNotice}>
                إغلاق
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
