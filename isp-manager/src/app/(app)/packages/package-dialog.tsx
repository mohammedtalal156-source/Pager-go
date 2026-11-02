"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { packageSchema, type PackageInput, type PackageOutput } from "@/lib/validation/catalog";
import type { Package } from "@/lib/types";
import { savePackage, setPackageActive } from "./actions";

export function PackageDialog({ pkg }: { pkg?: Package }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {pkg ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> تعديل
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> إضافة باقة
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pkg ? `تعديل: ${pkg.name}` : "إضافة باقة"}</DialogTitle>
          </DialogHeader>
          {open && <PackageForm pkg={pkg} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PackageForm({ pkg, onDone }: { pkg?: Package; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const form = useForm<PackageInput, unknown, PackageOutput>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      id: pkg?.id,
      name: pkg?.name ?? "",
      price: pkg ? String(pkg.price) : "",
      duration_days: pkg ? String(pkg.duration_days) : "30",
      description: pkg?.description ?? "",
      is_active: pkg?.is_active ?? true,
    },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(undefined);
      const res = await savePackage(values);
      if (res.ok) {
        toast.success(res.message);
        onDone();
      } else setError(res.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Field label="اسم الباقة" htmlFor="p-name" error={err.name?.message} required>
        <Input id="p-name" placeholder="مثال: باقة 25 ألف" {...form.register("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="السعر (دينار)" htmlFor="p-price" error={err.price?.message} required>
          <Input id="p-price" inputMode="numeric" dir="ltr" placeholder="25000" {...form.register("price")} />
        </Field>
        <Field label="المدة (يوم)" htmlFor="p-days" error={err.duration_days?.message} required>
          <Input id="p-days" inputMode="numeric" dir="ltr" {...form.register("duration_days")} />
        </Field>
      </div>
      <Field label="السرعة أو الوصف" htmlFor="p-desc" error={err.description?.message}>
        <Input id="p-desc" placeholder="مثال: 10 ميغا" {...form.register("description")} />
      </Field>
      <Controller
        control={form.control}
        name="is_active"
        render={({ field }) => (
          <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
            الباقة فعّالة (تظهر عند الإضافة والتجديد)
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </label>
        )}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pkg ? "حفظ" : "إضافة الباقة"}
      </Button>
    </form>
  );
}

export function PackageActiveSwitch({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={active}
      disabled={pending}
      aria-label="تفعيل الباقة"
      onCheckedChange={(v) =>
        startTransition(async () => {
          const res = await setPackageActive({ id, active: v });
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
        })
      }
    />
  );
}
