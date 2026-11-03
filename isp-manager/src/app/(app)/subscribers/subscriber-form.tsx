"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, CirclePause, Loader2, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addDays, todayBaghdad } from "@/lib/arabic";
import { cn, formatIQD } from "@/lib/utils";
import type { Collector, Package, SubscriberRow, Tower } from "@/lib/types";
import {
  createSubscriberSchema,
  editSubscriberSchema,
  type CreateSubscriberInput,
  type CreateSubscriberOutput,
  type EditSubscriberInput,
  type EditSubscriberOutput,
} from "@/lib/validation/subscriber";
import { createSubscriberAction, updateSubscriberAction } from "./actions";

export type Lists = { towers: Pick<Tower, "id" | "name" | "area">[]; packages: Package[]; collectors: Collector[] };

export function AddSubscriberButton({ lists, autoOpen = false }: { lists: Lists; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> إضافة مشترك
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>إضافة مشترك</DialogTitle>
          </DialogHeader>
          {open && <CreateForm lists={lists} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

const digits = (v: unknown) => Number(String(v ?? "").replace(/[^\d]/g, "") || 0);

function CreateForm({ lists, onDone }: { lists: Lists; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  // Active: first period starts now and the payment is recorded.
  // Inactive: saved without a subscription period, payment or debt (activate later with «تجديد»).
  const [active, setActive] = useState(true);
  const activePkgs = lists.packages.filter((p) => p.is_active);
  const firstPkg = activePkgs[0];
  const today = todayBaghdad();
  const form = useForm<CreateSubscriberInput, unknown, CreateSubscriberOutput>({
    resolver: zodResolver(createSubscriberSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      phone2: "",
      tower_id: lists.towers.length === 1 ? lists.towers[0].id : "",
      area: "",
      address: "",
      package_id: firstPkg?.id ?? "",
      price: firstPkg ? String(firstPkg.price) : "0",
      start_date: today,
      end_date: firstPkg ? addDays(today, firstPkg.duration_days) : addDays(today, 30),
      amount_paid: firstPkg ? String(firstPkg.price) : "0",
      collector_id: "",
      notes: "",
      request_id: crypto.randomUUID(),
    },
  });
  const err = form.formState.errors;
  const [pkgId, startDate, price, paid, towerId] = useWatch({
    control: form.control,
    name: ["package_id", "start_date", "price", "amount_paid", "tower_id"],
  });

  // Package → price & end date; tower → area.
  useEffect(() => {
    const p = lists.packages.find((x) => x.id === pkgId);
    if (!p) return;
    form.setValue("price", String(p.price));
    form.setValue("amount_paid", active ? String(p.price) : "0");
    if (startDate) form.setValue("end_date", addDays(String(startDate), p.duration_days));
  }, [pkgId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = lists.packages.find((x) => x.id === pkgId);
    if (startDate) form.setValue("end_date", addDays(String(startDate), p?.duration_days ?? 30));
  }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = lists.towers.find((x) => x.id === towerId);
    if (t?.area && !form.getValues("area")) form.setValue("area", t.area);
  }, [towerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = digits(price) - digits(paid);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(undefined);
      const res = await createSubscriberAction(active ? values : { ...values, start_date: null, end_date: null, amount_paid: 0 });
      if (res.ok) {
        toast.success(res.message);
        onDone();
        if (res.data?.id) router.push(`/subscribers/${res.data.id}`);
      } else setError(res.error);
    }),
  );

  if (lists.towers.length === 0) {
    return <Alert variant="warning">أضف برجاً واحداً على الأقل من صفحة الأبراج قبل إضافة المشتركين.</Alert>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">حالة المشترك</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="حالة المشترك">
          {[
            { value: true, icon: CircleCheck, title: "فعّال", hint: "يبدأ اشتراكه ويُسجَّل المبلغ" },
            { value: false, icon: CirclePause, title: "غير فعّال", hint: "بدون اشتراك ولا مبلغ" },
          ].map((o) => (
            <button
              key={o.title}
              type="button"
              role="radio"
              aria-checked={active === o.value}
              onClick={() => {
                setActive(o.value);
                // Hidden fields must stay valid: no payment while inactive.
                form.setValue("amount_paid", o.value ? String(form.getValues("price") ?? "0") : "0");
                form.clearErrors(["amount_paid", "start_date", "end_date"]);
              }}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 text-start transition-colors",
                active === o.value
                  ? o.value
                    ? "border-success bg-success-soft ring-2 ring-success"
                    : "border-primary bg-primary/10 ring-2 ring-primary"
                  : "bg-card hover:bg-accent",
              )}
            >
              <o.icon className={cn("mt-0.5 size-5 shrink-0", o.value ? "text-success" : "text-muted-foreground")} />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" htmlFor="n-name" error={err.full_name?.message} required>
          <Input id="n-name" autoFocus {...form.register("full_name")} />
        </Field>
        <Field label="رقم الهاتف" htmlFor="n-phone" error={err.phone?.message} required>
          <Input id="n-phone" type="tel" inputMode="tel" dir="ltr" placeholder="07xxxxxxxxx" {...form.register("phone")} />
        </Field>
        <Field label="البرج" htmlFor="n-tower" error={err.tower_id?.message} required>
          <NativeSelect id="n-tower" {...form.register("tower_id")}>
            <option value="">اختر البرج</option>
            {lists.towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="الباقة" htmlFor="n-pkg" error={err.package_id?.message}>
          <NativeSelect id="n-pkg" {...form.register("package_id")}>
            <option value="">بدون باقة</option>
            {activePkgs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatIQD(p.price)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {active && (
          <>
            <Field label="تاريخ البداية" htmlFor="n-start" error={err.start_date?.message}>
              <Input id="n-start" type="date" dir="ltr" {...form.register("start_date")} />
            </Field>
            <Field label="تاريخ الانتهاء" htmlFor="n-end" error={err.end_date?.message}>
              <Input id="n-end" type="date" dir="ltr" {...form.register("end_date")} />
            </Field>
          </>
        )}
        <Field label={active ? "سعر الاشتراك (دينار)" : "سعر الاشتراك عند التفعيل (دينار)"} htmlFor="n-price" error={err.price?.message}>
          <Input id="n-price" inputMode="numeric" dir="ltr" {...form.register("price")} />
        </Field>
        {active && (
          <Field label="المبلغ المدفوع" htmlFor="n-paid" error={err.amount_paid?.message}>
            <Input id="n-paid" inputMode="numeric" dir="ltr" {...form.register("amount_paid")} />
          </Field>
        )}
      </div>
      {active ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          المبلغ المتبقي:{" "}
          <b className={remaining > 0 ? "text-danger" : "text-success"}>{remaining < 0 ? "المدفوع أكبر من السعر" : formatIQD(remaining)}</b>
        </p>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          يُحفظ المشترك بدون تاريخ اشتراك ولا مبلغ ولا دين. عند التفعيل اضغط «تجديد» من صفحته: يبدأ الاشتراك من يوم التفعيل ويُسجَّل المبلغ.
        </p>
      )}
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">بيانات إضافية (اختياري)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="هاتف إضافي" htmlFor="n-phone2" error={err.phone2?.message}>
            <Input id="n-phone2" type="tel" inputMode="tel" dir="ltr" {...form.register("phone2")} />
          </Field>
          <Field label="المنطقة" htmlFor="n-area" error={err.area?.message}>
            <Input id="n-area" {...form.register("area")} />
          </Field>
          <Field label="العنوان" htmlFor="n-address" error={err.address?.message}>
            <Input id="n-address" {...form.register("address")} />
          </Field>
          <Field label="المحصّل المسؤول" htmlFor="n-collector" error={err.collector_id?.message}>
            <NativeSelect id="n-collector" {...form.register("collector_id")}>
              <option value="">بدون</option>
              {lists.collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="ملاحظات" htmlFor="n-notes" error={err.notes?.message} className="sm:col-span-2">
            <Textarea id="n-notes" rows={2} {...form.register("notes")} />
          </Field>
        </div>
      </details>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        حفظ المشترك
      </Button>
    </form>
  );
}

export function EditSubscriberButton({
  sub,
  lists,
  compact = false,
  className,
}: {
  sub: SubscriberRow;
  lists: Lists;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={compact ? "sm" : "default"} className={className} onClick={() => setOpen(true)}>
        <Pencil /> {compact ? "تعديل" : "تعديل المشترك"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل: {sub.full_name}</DialogTitle>
          </DialogHeader>
          {open && <EditForm sub={sub} lists={lists} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditForm({ sub, lists, onDone }: { sub: SubscriberRow; lists: Lists; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const form = useForm<EditSubscriberInput, unknown, EditSubscriberOutput>({
    resolver: zodResolver(editSubscriberSchema),
    defaultValues: {
      id: sub.id,
      full_name: sub.full_name,
      phone: sub.phone,
      phone2: sub.phone2 ?? "",
      tower_id: sub.tower_id,
      area: sub.area ?? "",
      address: sub.address ?? "",
      package_id: sub.package_id ?? "",
      price: String(sub.price),
      collector_id: sub.collector_id ?? "",
      notes: sub.notes ?? "",
    },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(undefined);
      const res = await updateSubscriberAction(values);
      if (res.ok) {
        toast.success(res.message);
        onDone();
      } else setError(res.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <p className="text-xs text-muted-foreground">
        التعديل هنا لا يغيّر الرصيد أو سجل المدفوعات. تغيير السعر يُطبَّق على التجديدات القادمة. التواريخ وتصحيح المبالغ من أزرار المدير في صفحة المشترك.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" htmlFor="e-name" error={err.full_name?.message} required>
          <Input id="e-name" {...form.register("full_name")} />
        </Field>
        <Field label="رقم الهاتف" htmlFor="e-phone" error={err.phone?.message} required>
          <Input id="e-phone" type="tel" inputMode="tel" dir="ltr" {...form.register("phone")} />
        </Field>
        <Field label="هاتف إضافي" htmlFor="e-phone2" error={err.phone2?.message}>
          <Input id="e-phone2" type="tel" inputMode="tel" dir="ltr" {...form.register("phone2")} />
        </Field>
        <Field label="البرج" htmlFor="e-tower" error={err.tower_id?.message} required>
          <NativeSelect id="e-tower" {...form.register("tower_id")}>
            {!lists.towers.some((t) => t.id === sub.tower_id) && <option value={sub.tower_id}>{sub.tower_name}</option>}
            {lists.towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="الباقة" htmlFor="e-pkg">
          <NativeSelect id="e-pkg" {...form.register("package_id")}>
            <option value="">بدون باقة</option>
            {lists.packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_active ? "" : " (متوقفة)"}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="سعر الاشتراك الشهري" htmlFor="e-price" error={err.price?.message}>
          <Input id="e-price" inputMode="numeric" dir="ltr" {...form.register("price")} />
        </Field>
        <Field label="المنطقة" htmlFor="e-area" error={err.area?.message}>
          <Input id="e-area" {...form.register("area")} />
        </Field>
        <Field label="العنوان" htmlFor="e-address" error={err.address?.message}>
          <Input id="e-address" {...form.register("address")} />
        </Field>
        <Field label="الجابي المسؤول" htmlFor="e-collector">
          <NativeSelect id="e-collector" {...form.register("collector_id")}>
            <option value="">بدون</option>
            {sub.collector_id && !lists.collectors.some((c) => c.id === sub.collector_id) && (
              <option value={sub.collector_id}>الجابي الحالي (غير فعّال)</option>
            )}
            {lists.collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="ملاحظات" htmlFor="e-notes" error={err.notes?.message}>
          <Textarea id="e-notes" rows={2} {...form.register("notes")} />
        </Field>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        حفظ التعديلات
      </Button>
    </form>
  );
}
