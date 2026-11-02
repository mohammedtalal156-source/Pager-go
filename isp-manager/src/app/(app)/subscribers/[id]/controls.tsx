"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, CalendarCog, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setDatesAction, setSubscriberArchivedAction, voidPaymentAction, voidRenewalAction } from "../actions";

/** Admin: void a payment or the latest renewal, with a mandatory reason. */
export function VoidButton({ kind, id, subscriberId, label }: { kind: "payment" | "renewal"; id: string; subscriberId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const res = kind === "payment" ? await voidPaymentAction({ id, reason }, subscriberId) : await voidRenewalAction({ id, reason }, subscriberId);
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      } else setError(res.error);
    });
  return (
    <>
      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setOpen(true)}>
        <Undo2 /> إلغاء
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{kind === "payment" ? "إلغاء دفعة" : "إلغاء آخر تجديد"}</DialogTitle>
            <DialogDescription>{label}. تبقى الحركة محفوظة كـ«ملغاة» في السجل مع السبب واسمك.</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid gap-1.5">
            <Label htmlFor="v-reason">سبب الإلغاء</Label>
            <Input id="v-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={submit}>
            {pending && <Loader2 className="animate-spin" />}
            تأكيد الإلغاء
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Admin: correct start/end dates (audited). */
export function DatesButton({ id, start, end }: { id: string; start: string | null; end: string | null }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(start ?? "");
  const [e, setE] = useState(end ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await setDatesAction({ id, start_date: s, end_date: e, reason });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      } else setError(res.error);
    });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarCog /> تعديل التواريخ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل تواريخ الاشتراك</DialogTitle>
            <DialogDescription>للتصحيح فقط. يُسجَّل التعديل مع السبب في سجل التدقيق.</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="d-start">البداية</Label>
              <Input id="d-start" type="date" dir="ltr" value={s} onChange={(ev) => setS(ev.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-end">الانتهاء</Label>
              <Input id="d-end" type="date" dir="ltr" value={e} onChange={(ev) => setE(ev.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-reason">السبب</Label>
            <Input id="d-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </div>
          <Button disabled={pending || reason.trim().length < 3} onClick={submit}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ArchiveSubscriberButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!archived && !window.confirm("أرشفة المشترك؟ تبقى كل سجلاته المالية محفوظة.")) return;
        startTransition(async () => {
          const res = await setSubscriberArchivedAction({ id, archived: !archived });
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : archived ? <ArchiveRestore /> : <Archive />}
      {archived ? "استعادة" : "أرشفة"}
    </Button>
  );
}
