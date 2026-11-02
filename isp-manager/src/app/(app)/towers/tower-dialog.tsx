"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { towerSchema, type TowerInput, type TowerOutput } from "@/lib/validation/catalog";
import type { Tower } from "@/lib/types";
import { saveTower, setTowerArchived } from "./actions";

export function TowerDialog({ tower }: { tower?: Tower }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {tower ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> تعديل
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> إضافة برج
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tower ? `تعديل: ${tower.name}` : "إضافة برج"}</DialogTitle>
          </DialogHeader>
          {open && <TowerForm tower={tower} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TowerForm({ tower, onDone }: { tower?: Tower; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const form = useForm<TowerInput, unknown, TowerOutput>({
    resolver: zodResolver(towerSchema),
    defaultValues: {
      id: tower?.id,
      name: tower?.name ?? "",
      area: tower?.area ?? "",
      address: tower?.address ?? "",
      manager_name: tower?.manager_name ?? "",
      manager_phone: tower?.manager_phone ?? "",
      notes: tower?.notes ?? "",
    },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(undefined);
      const res = await saveTower(values);
      if (res.ok) {
        toast.success(res.message);
        onDone();
      } else setError(res.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم البرج" htmlFor="t-name" error={err.name?.message} required>
          <Input id="t-name" {...form.register("name")} />
        </Field>
        <Field label="المنطقة" htmlFor="t-area" error={err.area?.message}>
          <Input id="t-area" {...form.register("area")} />
        </Field>
      </div>
      <Field label="العنوان" htmlFor="t-address" error={err.address?.message}>
        <Input id="t-address" {...form.register("address")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المسؤول" htmlFor="t-manager" error={err.manager_name?.message}>
          <Input id="t-manager" {...form.register("manager_name")} />
        </Field>
        <Field label="هاتف المسؤول" htmlFor="t-phone" error={err.manager_phone?.message}>
          <Input id="t-phone" type="tel" inputMode="tel" dir="ltr" {...form.register("manager_phone")} />
        </Field>
      </div>
      <Field label="ملاحظات" htmlFor="t-notes" error={err.notes?.message}>
        <Textarea id="t-notes" rows={2} {...form.register("notes")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {tower ? "حفظ التعديلات" : "إضافة البرج"}
      </Button>
    </form>
  );
}

export function ArchiveTowerButton({ id, archived, name }: { id: string; archived: boolean; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!archived && !window.confirm(`أرشفة البرج «${name}»؟ يبقى سجل المشتركين والحسابات محفوظاً.`)) return;
        startTransition(async () => {
          const res = await setTowerArchived({ id, archived: !archived });
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
