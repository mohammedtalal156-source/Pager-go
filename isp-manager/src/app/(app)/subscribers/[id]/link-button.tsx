"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { linkMessage, subscriberLinkUrl, whatsAppShareUrl } from "@/lib/subscriber-link";
import { formatDate } from "@/lib/utils";
import { subscriberLinkAction } from "../actions";

/** «رابط المشترك»: send / copy / replace the subscriber's private page link. */
export function SubscriberLinkButton({
  id,
  name,
  phone,
  endDate,
  className,
}: {
  id: string;
  name: string;
  phone: string | null;
  endDate: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = (reset = false) =>
    startTransition(async () => {
      setError(undefined);
      const res = await subscriberLinkAction(id, reset);
      if (res.ok && res.data) {
        setUrl(subscriberLinkUrl(window.location.origin, res.data.token));
        setConfirmReset(false);
        if (res.message) toast.success(res.message);
      } else if (!res.ok) setError(res.error);
    });

  const message = url ? linkMessage(name, endDate ? formatDate(endDate) : null, url) : "";

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={() => {
          setOpen(true);
          setConfirmReset(false);
          if (!url) load();
        }}
      >
        <Link2 /> رابط المشترك
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رابط {name}</DialogTitle>
            <DialogDescription>
              يفتحه المشترك بدون تسجيل دخول ويشاهد اشتراكه وتاريخ الانتهاء ودينه وآخر دفعاته فقط. لا يستطيع تعديل أي شيء.
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          {!url ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-2">
              <p dir="ltr" className="truncate rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {url}
              </p>
              <Button asChild size="lg" className="h-12 bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                <a href={whatsAppShareUrl(phone, message)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> إرسال بالواتساب
                </a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("تم نسخ الرابط");
                  } catch {
                    toast.error("تعذّر النسخ، انسخ الرابط يدوياً");
                  }
                }}
              >
                <Copy /> نسخ الرابط
              </Button>
              {!confirmReset ? (
                <Button variant="ghost" className="text-danger hover:text-danger" disabled={pending} onClick={() => setConfirmReset(true)}>
                  <RefreshCw /> تغيير الرابط
                </Button>
              ) : (
                <div className="grid gap-2 rounded-lg border border-danger/40 p-3">
                  <p className="text-sm">الرابط القديم سيتوقف فوراً، وستحتاج إرسال الرابط الجديد للمشترك. متأكد؟</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="destructive" disabled={pending} onClick={() => load(true)}>
                      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} نعم، غيّره
                    </Button>
                    <Button variant="outline" onClick={() => setConfirmReset(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
