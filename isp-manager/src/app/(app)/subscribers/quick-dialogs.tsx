"use client";

import { useState, useTransition } from "react";
import { Banknote, CheckCircle2, Loader2, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addDays, addMonths, renewalMessage, todayBaghdad, whatsappReminder } from "@/lib/arabic";
import { cn, formatDate, formatIQD } from "@/lib/utils";
import type { Package, SubscriberPerms, SubscriberRow } from "@/lib/types";
import { collectAction, renewAction } from "./actions";
import { EditSubscriberButton, type Lists } from "./subscriber-form";

const digits = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[^\d]/g, "");
const num = (v: string) => (digits(v) === "" ? 0 : Number(digits(v)));
const fmt = new Intl.NumberFormat("en-US");

function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      dir="ltr"
      className="h-12 text-lg font-semibold tabular-nums"
      value={value === "" ? "" : fmt.format(num(value))}
      onChange={(e) => onChange(digits(e.target.value))}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", className)}>{value}</p>
    </div>
  );
}

export function RenewDialog({
  sub,
  packages,
  isAdmin,
  open,
  onOpenChange,
}: {
  sub: SubscriberRow;
  packages: Package[];
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تجديد اشتراك</DialogTitle>
          <DialogDescription>
            {sub.full_name} · #{sub.code}
          </DialogDescription>
        </DialogHeader>
        {open && <RenewForm sub={sub} packages={packages} isAdmin={isAdmin} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenewForm({ sub, packages, isAdmin, onDone }: { sub: SubscriberRow; packages: Package[]; isAdmin: boolean; onDone: () => void }) {
  const active = packages.filter((p) => p.is_active || p.id === sub.package_id);
  const initialPkg = active.find((p) => p.id === sub.package_id) ?? active[0];
  const [requestId] = useState(() => crypto.randomUUID());
  const [pkgId, setPkgId] = useState(initialPkg?.id ?? "");
  const [periods, setPeriods] = useState(1);
  const pkg = active.find((p) => p.id === pkgId);
  const unit = pkg?.price ?? sub.price;
  const [price, setPrice] = useState(String(unit));
  const [priceTouched, setPriceTouched] = useState(false);
  const [received, setReceived] = useState(String(unit));
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [override, setOverride] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // After a successful renewal: the WhatsApp message to send to the subscriber.
  const [done, setDone] = useState<{ end: string; balance: number; wa: string | null }>();

  const syncAmounts = (nextUnit: number, nextPeriods: number) => {
    if (!priceTouched) {
      setPrice(String(nextUnit * nextPeriods));
      if (!receivedTouched) setReceived(String(nextUnit * nextPeriods));
    }
  };

  const today = todayBaghdad();
  const days = (pkg?.duration_days ?? 30) * periods;
  const pkgDays = pkg?.duration_days ?? 30;
  const monthly = Boolean(sub.tower_monthly);
  // Monthly towers: same day next month(s), as the database computes it.
  const months = Math.max(1, Math.round(pkgDays / 30)) * periods;
  const periodEndFrom = (base: string) => (monthly ? addMonths(base, months) : addDays(base, days));
  const preview = override
    ? { start: override, end: periodEndFrom(override) }
    : sub.end_date && sub.end_date >= today
      ? { start: addDays(sub.end_date, 1), end: periodEndFrom(sub.end_date) }
      : { start: today, end: periodEndFrom(today) };

  const priceN = num(price);
  const receivedN = num(received);
  const remaining = sub.balance + priceN - receivedN;

  const submit = () => {
    setError(undefined);
    if (receivedN > sub.balance + priceN) {
      setError("المبلغ المستلم أكبر من المستحق");
      return;
    }
    startTransition(async () => {
      const res = await renewAction({
        subscriber_id: sub.id,
        periods,
        price: priceN,
        amount_received: receivedN,
        package_id: pkgId,
        start_override: override,
        request_id: requestId,
      });
      if (res.ok) {
        toast.success(`تم التجديد حتى ${formatDate(res.data?.end_date)}`, {
          description: res.data && res.data.balance > 0 ? `المتبقي: ${formatIQD(res.data.balance)}` : "لا يوجد دين",
          icon: <CheckCircle2 className="size-5 text-success" />,
        });
        const end = res.data?.end_date ?? preview.end;
        setDone({
          end,
          balance: res.data?.balance ?? 0,
          wa: renewalMessage({ name: sub.full_name, phone: sub.phone, renewedOn: todayBaghdad(), endDate: end, price: priceN }),
        });
      } else setError(res.error);
    });
  };

  if (done) {
    return (
      <div className="grid gap-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <p className="text-lg font-bold">تم التجديد حتى {formatDate(done.end)}</p>
        <p className="text-sm text-muted-foreground">{done.balance > 0 ? `المتبقي: ${formatIQD(done.balance)}` : "لا يوجد دين"}</p>
        {done.wa ? (
          <Button asChild size="lg" className="h-14 bg-[#25D366] text-lg text-white hover:bg-[#1ebe5b]">
            <a href={done.wa} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onDone, 300)}>
              <MessageCircle /> إرسال رسالة التجديد بالواتساب
            </a>
          </Button>
        ) : (
          <Alert variant="warning">رقم المشترك غير صالح للواتساب، لا يمكن إرسال الرسالة.</Alert>
        )}
        <Button variant="outline" size="lg" onClick={onDone}>
          إغلاق
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Info label="البرج" value={sub.tower_name} />
        <Info label="الباقة الحالية" value={sub.package_name ?? "—"} />
        <Info
          label="تاريخ الانتهاء"
          value={formatDate(sub.end_date)}
          className={sub.status === "expired" ? "text-danger" : sub.status === "expiring" ? "text-warning" : ""}
        />
        <Info label="دين سابق" value={formatIQD(sub.balance)} className={sub.balance > 0 ? "text-danger" : ""} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="r-pkg">الباقة</Label>
        <NativeSelect
          id="r-pkg"
          value={pkgId}
          onChange={(e) => {
            setPkgId(e.target.value);
            const p = active.find((x) => x.id === e.target.value);
            syncAmounts(p?.price ?? sub.price, periods);
          }}
        >
          {active.length === 0 && <option value="">بدون باقة</option>}
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatIQD(p.price)} / {p.duration_days} يوم
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-1.5">
        <Label>مدة التجديد</Label>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 6].map((n) => (
            <Button
              key={n}
              type="button"
              variant={periods === n ? "default" : "outline"}
              onClick={() => {
                setPeriods(n);
                syncAmounts(unit, n);
              }}
            >
              {n === 1 ? "شهر" : n === 2 ? "شهرين" : `${n} أشهر`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="r-price">السعر</Label>
          <MoneyInput
            id="r-price"
            value={price}
            onChange={(v) => {
              setPrice(v);
              setPriceTouched(true);
              if (!receivedTouched) setReceived(v);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="r-received">المبلغ المستلم</Label>
          <MoneyInput
            id="r-received"
            value={received}
            onChange={(v) => {
              setReceived(v);
              setReceivedTouched(true);
            }}
          />
        </div>
      </div>

      {isAdmin && (
        <div className="grid gap-1.5">
          <Label htmlFor="r-start">تاريخ بداية مخصص (للمدير، اختياري)</Label>
          <Input id="r-start" type="date" dir="ltr" value={override} onChange={(e) => setOverride(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 text-sm">
        <span className="text-muted-foreground">الاشتراك الجديد</span>
        <span className="font-semibold">
          {formatDate(preview.start)} ← {formatDate(preview.end)}
        </span>
        <span className="text-muted-foreground">المتبقي بعد التجديد</span>
        <span className={cn("font-bold", remaining > 0 ? "text-danger" : "text-success")}>
          {remaining < 0 ? "المبلغ أكبر من المستحق" : formatIQD(remaining)}
        </span>
      </div>

      <Button size="lg" variant="success" className="h-14 text-lg" disabled={pending || remaining < 0} onClick={submit}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        تأكيد التجديد
      </Button>
    </div>
  );
}

export function CollectDialog({
  sub,
  open,
  onOpenChange,
}: {
  sub: SubscriberRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تحصيل دفعة</DialogTitle>
          <DialogDescription>
            {sub.full_name} · #{sub.code}
          </DialogDescription>
        </DialogHeader>
        {open && <CollectForm sub={sub} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CollectForm({ sub, onDone }: { sub: SubscriberRow; onDone: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(String(sub.balance));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const amountN = num(amount);
  const after = sub.balance - amountN;

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const res = await collectAction({ subscriber_id: sub.id, amount: amountN, notes, request_id: requestId });
      if (res.ok) {
        toast.success(`تم تسجيل ${formatIQD(amountN)}`, {
          description: res.data && res.data.balance > 0 ? `المتبقي: ${formatIQD(res.data.balance)}` : "تم تسديد الدين بالكامل",
        });
        onDone();
      } else setError(res.error);
    });
  };

  if (sub.balance <= 0) return <Alert variant="success">لا يوجد دين على هذا المشترك.</Alert>;

  return (
    <div className="grid gap-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Info label="البرج" value={sub.tower_name} />
        <Info label="الدين الحالي" value={formatIQD(sub.balance)} className="text-danger" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-amount">المبلغ المستلم</Label>
        <MoneyInput id="c-amount" value={amount} onChange={setAmount} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-notes">ملاحظة (اختياري)</Label>
        <Input id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-between rounded-xl border p-3 text-sm">
        <span className="text-muted-foreground">المتبقي بعد الدفعة</span>
        <span className={cn("font-bold", after > 0 ? "text-danger" : "text-success")}>
          {after < 0 ? "المبلغ أكبر من الدين" : formatIQD(after)}
        </span>
      </div>
      <Button size="lg" variant="success" className="h-14 text-lg" disabled={pending || amountN <= 0 || after < 0} onClick={submit}>
        {pending ? <Loader2 className="animate-spin" /> : <Banknote />}
        تأكيد التحصيل
      </Button>
    </div>
  );
}

/** Row buttons: renew · collect · edit (when lists are given) · call · WhatsApp. */
export function SubscriberQuickActions({
  sub,
  packages,
  perms,
  compact = false,
  lists,
}: {
  sub: SubscriberRow;
  packages: Package[];
  perms: SubscriberPerms;
  compact?: boolean;
  lists?: Lists;
}) {
  const [renewOpen, setRenewOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const wa = whatsappReminder({
    name: sub.full_name,
    phone: sub.phone,
    endDate: sub.end_date,
    expired: sub.status === "expired",
    formattedDate: formatDate(sub.end_date),
    formattedStart: sub.start_date ? formatDate(sub.start_date) : null,
  });
  const size = compact ? "sm" : "default";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {perms.renew && !sub.is_archived && (
        <Button size={size} onClick={() => setRenewOpen(true)}>
          <RefreshCw /> تجديد
        </Button>
      )}
      {perms.collect && sub.balance > 0 && (
        <Button size={size} variant="success" onClick={() => setCollectOpen(true)}>
          <Banknote /> تحصيل
        </Button>
      )}
      {lists && perms.edit && !sub.is_archived && <EditSubscriberButton sub={sub} lists={lists} compact={compact} />}
      <Button size={compact ? "icon-sm" : "icon"} variant="outline" asChild>
        <a href={`tel:${sub.phone}`} aria-label="اتصال">
          <Phone />
        </a>
      </Button>
      {wa ? (
        <Button size={compact ? "icon-sm" : "icon"} variant="outline" asChild className="text-success">
          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="رسالة تذكير واتساب" title="رسالة تذكير واتساب">
            <MessageCircle />
          </a>
        </Button>
      ) : (
        <Button size={compact ? "icon-sm" : "icon"} variant="outline" disabled aria-label="رقم غير صالح لواتساب" title="رقم غير صالح لواتساب">
          <MessageCircle />
        </Button>
      )}
      {renewOpen && <RenewDialog sub={sub} packages={packages} isAdmin={perms.admin} open={renewOpen} onOpenChange={setRenewOpen} />}
      {collectOpen && <CollectDialog sub={sub} open={collectOpen} onOpenChange={setCollectOpen} />}
    </div>
  );
}
