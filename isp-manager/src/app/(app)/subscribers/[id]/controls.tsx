"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CalendarCog, HandCoins, History, Loader2, PenLine, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addDays, todayBaghdad } from "@/lib/arabic";
import { daysBetween, describeHistory, parseManualDate, type HistoryItem, type Lookups } from "@/lib/corrections";
import { cn, formatDate, formatDateTime, formatIQD } from "@/lib/utils";
import {
  adjustDebtAction,
  correctPaymentAction,
  deleteSubscriberAction,
  setDatesAction,
  setSubscriberArchivedAction,
  subscriberHistoryAction,
  voidPaymentAction,
  voidRenewalAction,
} from "../actions";

const toDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[^\d]/g, "");
const fmt = new Intl.NumberFormat("en-US");

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

/** Admin: fix a wrongly-entered amount. Voids the original and records the right amount in one step. */
export function CorrectPaymentButton({
  id,
  subscriberId,
  receiptNo,
  amount,
  balance,
}: {
  id: string;
  subscriberId: string;
  receiptNo: number;
  amount: number;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const newAmount = toDigits(value) === "" ? 0 : Number(toDigits(value));
  const after = balance + amount - newAmount;
  const valid = newAmount > 0 && newAmount !== amount && after >= 0 && reason.trim().length >= 3;

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await correctPaymentAction({ id, amount: newAmount, reason, request_id: requestId }, subscriberId);
      if (res.ok) {
        toast.success(`تم التصحيح: ${formatIQD(res.data?.amount ?? newAmount)}`, {
          description: `المتبقي على المشترك: ${formatIQD(res.data?.balance ?? after)}`,
        });
        setOpen(false);
      } else setError(res.error);
    });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-primary"
        onClick={() => {
          setRequestId(crypto.randomUUID());
          setValue("");
          setReason("");
          setError(undefined);
          setOpen(true);
        }}
      >
        <PenLine /> تصحيح
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تصحيح دفعة — وصل #{receiptNo}</DialogTitle>
            <DialogDescription>
              تُلغى الدفعة الخاطئة مع ذكر السبب وتُسجَّل دفعة بالمبلغ الصحيح بنفس التاريخ، في عملية واحدة. تبقى الدفعة الأصلية ظاهرة في السجل.
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-[11px] text-muted-foreground">المبلغ المسجّل (الخاطئ)</p>
              <p className="text-sm font-semibold tabular-nums line-through decoration-danger">{formatIQD(amount)}</p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-[11px] text-muted-foreground">المتبقي حالياً</p>
              <p className="text-sm font-semibold tabular-nums">{formatIQD(balance)}</p>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-amount">المبلغ الصحيح المدفوع</Label>
            <Input
              id="cp-amount"
              inputMode="numeric"
              dir="ltr"
              autoFocus
              className="h-12 text-lg font-semibold tabular-nums"
              value={value === "" ? "" : fmt.format(newAmount)}
              onChange={(e) => setValue(toDigits(e.target.value))}
            />
          </div>
          {newAmount > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 text-sm">
              <span className="text-muted-foreground">المدفوع بعد التصحيح</span>
              <span className="font-semibold tabular-nums">{formatIQD(newAmount)}</span>
              <span className="text-muted-foreground">المتبقي بعد التصحيح</span>
              <span className={cn("font-bold tabular-nums", after < 0 ? "text-danger" : after > 0 ? "text-danger" : "text-success")}>
                {after < 0 ? "المبلغ أكبر من المستحق" : formatIQD(after)}
              </span>
            </div>
          )}
          {newAmount === amount && <p className="text-xs text-warning">المبلغ مطابق للمسجّل، لا حاجة للتصحيح.</p>}
          <div className="grid gap-1.5">
            <Label htmlFor="cp-reason">سبب التصحيح</Label>
            <Input id="cp-reason" placeholder="مثال: خطأ بالإدخال، المشترك دفع 15 ألف" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button size="lg" className="h-12" disabled={pending || !valid} onClick={submit}>
            {pending && <Loader2 className="animate-spin" />}
            تأكيد التصحيح
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Admin: set the remaining debt to an exact amount. Recorded as a debt adjustment, never as cash. */
export function AdjustDebtButton({ subscriberId, balance, className }: { subscriberId: string; balance: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const newBalance = toDigits(value) === "" ? null : Number(toDigits(value));
  const diff = newBalance === null ? 0 : newBalance - balance;
  const valid = newBalance !== null && diff !== 0 && newBalance <= 1_000_000_000 && reason.trim().length >= 3;

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await adjustDebtAction({
        subscriber_id: subscriberId,
        new_balance: newBalance,
        expected_balance: balance,
        reason,
        request_id: requestId,
      });
      if (res.ok) {
        toast.success(`تم تعديل الدين إلى ${formatIQD(res.data?.balance ?? newBalance ?? 0)}`);
        setOpen(false);
      } else setError(res.error);
    });

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={() => {
          setRequestId(crypto.randomUUID());
          setValue("");
          setReason("");
          setError(undefined);
          setOpen(true);
        }}
      >
        <HandCoins /> تعديل الدين
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الدين</DialogTitle>
            <DialogDescription>
              تُسجَّل تسوية دين منفصلة باسمك مع السبب. لا تتغيّر المدفوعات القديمة ولا تُحسب التسوية كإيراد أو دفعة نقدية.
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="rounded-lg bg-muted px-3 py-2">
            <p className="text-[11px] text-muted-foreground">الدين الحالي</p>
            <p className="text-lg font-bold tabular-nums">{formatIQD(balance)}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ad-new">الدين الجديد (المبلغ النهائي المطلوب)</Label>
            <Input
              id="ad-new"
              inputMode="numeric"
              dir="ltr"
              autoFocus
              placeholder="0"
              className="h-12 text-lg font-semibold tabular-nums"
              value={value === "" ? "" : fmt.format(Number(toDigits(value)))}
              onChange={(e) => setValue(toDigits(e.target.value))}
            />
          </div>
          {newBalance !== null && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 text-sm">
              <span className="text-muted-foreground">الفرق</span>
              <span className={cn("font-bold tabular-nums", diff > 0 ? "text-danger" : diff < 0 ? "text-success" : "")}>
                {diff === 0 ? "لا يوجد فرق" : `${diff > 0 ? "+" : "−"}${formatIQD(Math.abs(diff))}`}
              </span>
              <span className="text-muted-foreground">نوع التسوية</span>
              <span className="font-semibold">{diff > 0 ? "زيادة الدين" : diff < 0 ? "تخفيض الدين" : "—"}</span>
              <span className="text-muted-foreground">الدين بعد الحفظ</span>
              <span className="font-bold tabular-nums">{formatIQD(newBalance)}</span>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="ad-reason">سبب التعديل (إجباري)</Label>
            <Input id="ad-reason" placeholder="مثال: دين سابق غير مسجل" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button size="lg" className="h-12" disabled={pending || !valid} onClick={submit}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ التعديل
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Calendar picker plus a typed alternative (e.g. 1/12/2026). */
function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [typed, setTyped] = useState("");
  const typedOk = parseManualDate(typed);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" dir="ltr" className="h-11" value={value} onChange={(e) => onChange(e.target.value)} />
      <Input
        aria-label={`${label} — إدخال يدوي`}
        inputMode="numeric"
        dir="ltr"
        placeholder="أو اكتب: 1/12/2026"
        className={cn("h-9 text-sm", typed && !typedOk && "border-danger")}
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          const v = parseManualDate(e.target.value);
          if (v) onChange(v);
        }}
      />
      {value && <p className="text-xs text-muted-foreground">{formatDate(value)}</p>}
    </div>
  );
}

/** Admin: correct start/end dates (audited). Billed periods and renewal history are not touched. */
export function DatesButton({ id, start, end, className }: { id: string; start: string | null; end: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(start ?? "");
  const [e, setE] = useState(end ?? "");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const today = todayBaghdad();
  const duration = s && e ? daysBetween(s, e) : null;
  const status = !e ? null : e < today ? "منتهي" : daysBetween(today, e) <= 3 ? "قريب الانتهاء" : "فعّال";
  const badOrder = duration !== null && duration < 0;

  const applyDays = (n: number) => {
    const base = s || today;
    if (!s) setS(base);
    setE(addDays(base, n));
  };

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
      <Button
        variant="outline"
        className={className}
        onClick={() => {
          setS(start ?? "");
          setE(end ?? "");
          setReason("");
          setError(undefined);
          setOpen(true);
        }}
      >
        <CalendarCog /> تعديل التواريخ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل تواريخ الاشتراك</DialogTitle>
            <DialogDescription>يغيّر الاشتراك الحالي فقط. سجل التجديدات والمبالغ لا يتغيّر، ويُحفظ التعديل مع السبب في سجل التعديلات.</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <DateField id="d-start" label="تاريخ البداية" value={s} onChange={setS} />
            <DateField id="d-end" label="تاريخ الانتهاء" value={e} onChange={setE} />
          </div>
          <div className="grid gap-1.5">
            <Label>أو حدّد المدة من تاريخ البداية</Label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 90].map((n) => (
                <Button key={n} type="button" variant={duration === n ? "default" : "outline"} onClick={() => applyDays(n)}>
                  {n === 30 ? "شهر" : n === 60 ? "شهرين" : "3 أشهر"}
                </Button>
              ))}
              <Input
                aria-label="عدد الأيام"
                inputMode="numeric"
                dir="ltr"
                placeholder="أيام"
                value={days}
                onChange={(ev) => {
                  const d = toDigits(ev.target.value);
                  setDays(d);
                  if (d && Number(d) > 0 && Number(d) <= 3660) applyDays(Number(d));
                }}
              />
            </div>
          </div>
          {(duration !== null || status) && (
            <div className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm">
              {duration !== null && <span>المدة: <b className="tabular-nums">{duration}</b> يوم</span>}
              {status && (
                <span>
                  الحالة بعد الحفظ:{" "}
                  <b className={status === "منتهي" ? "text-danger" : status === "فعّال" ? "text-success" : "text-warning"}>{status}</b>
                </span>
              )}
            </div>
          )}
          {badOrder && <Alert variant="destructive">تاريخ الانتهاء قبل تاريخ البداية</Alert>}
          <div className="grid gap-1.5">
            <Label htmlFor="d-reason">سبب التعديل</Label>
            <Input id="d-reason" placeholder="مثال: تصحيح تاريخ الانتهاء" value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </div>
          <Button size="lg" className="h-12" disabled={pending || badOrder || reason.trim().length < 3} onClick={submit}>
            {pending && <Loader2 className="animate-spin" />}
            حفظ التواريخ
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Admin: who changed what and why. */
export function HistoryButton({ subscriberId, lookups, className }: { subscriberId: string; lookups: Lookups; className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const load = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await subscriberHistoryAction(subscriberId);
      if (res.ok) setItems(describeHistory(res.data ?? [], lookups));
      else setError(res.error);
    });
  const toneCls = { info: "border-s-primary", money: "border-s-success", danger: "border-s-danger", date: "border-s-warning" } as const;

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={() => {
          setOpen(true);
          load();
        }}
      >
        <History /> سجل التعديلات
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>سجل التعديلات</DialogTitle>
            <DialogDescription>كل إضافة أو تعديل أو إلغاء أو تصحيح، مع اسم من قام به والوقت والسبب.</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          {pending && !items && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
            </p>
          )}
          {items && items.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حركات مسجّلة.</p>}
          {items && items.length > 0 && (
            <ol className="grid max-h-[60vh] gap-2 overflow-y-auto">
              {items.map((it) => (
                <li key={it.id} className={cn("rounded-lg border border-s-4 p-2.5 text-sm", toneCls[it.tone])}>
                  <p className="font-medium">{it.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(it.at)} · {it.who}
                  </p>
                  {it.changes.length > 0 && (
                    <ul className="mt-1.5 grid gap-0.5 text-xs">
                      {it.changes.map((c) => (
                        <li key={c.label}>
                          {c.label}: <span className="text-muted-foreground line-through">{c.from}</span> ← <b>{c.to}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                  {it.reason && <p className="mt-1 text-xs">السبب: {it.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ArchiveSubscriberButton({ id, archived, className }: { id: string; archived: boolean; className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className={className}
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

/** Admin: delete the subscriber with all periods and payments (asks to type «حذف»). */
export function DeleteSubscriberButton({
  id,
  name,
  paidTotal,
  className,
}: {
  id: string;
  name: string;
  paidTotal: number;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await deleteSubscriberAction(id, confirm);
      if (res.ok) {
        toast.success(`تم حذف ${name}`);
        setOpen(false);
        router.replace("/subscribers");
      } else setError(res.error);
    });
  return (
    <>
      <Button
        variant="ghost"
        className={cn("text-danger hover:text-danger", className)}
        onClick={() => {
          setConfirm("");
          setError(undefined);
          setOpen(true);
        }}
      >
        <Trash2 /> حذف المشترك
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف {name}؟</DialogTitle>
            <DialogDescription>
              يختفي المشترك من القوائم ولوحة التحكم والتقارير، وتُلغى كل اشتراكاته ومدفوعاته{paidTotal > 0 ? ` (${formatIQD(paidTotal)})` : ""}
              وتنقص من المقبوضات، ويصير دينه صفراً. تبقى نسخة محفوظة في قاعدة البيانات لاسترجاعها عند الخطأ. إذا تريد إخفاءه فقط مع بقاء
              حساباته استخدم «أرشفة».
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid gap-1.5">
            <Label htmlFor="del-confirm">اكتب «حذف» للتأكيد</Label>
            <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <Button variant="destructive" size="lg" className="h-12" disabled={pending || confirm.trim() !== "حذف"} onClick={submit}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            حذف نهائي
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
