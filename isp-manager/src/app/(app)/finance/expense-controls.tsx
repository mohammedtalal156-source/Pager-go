"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { todayBaghdad } from "@/lib/arabic";
import { EXPENSE_CATEGORIES, expenseSchema, type ExpenseInput, type ExpenseOutput } from "@/lib/validation/expense";
import { addExpenseAction, voidExpenseAction } from "./actions";

export function AddExpenseButton({ towers }: { towers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> تسجيل مصروف
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل مصروف</DialogTitle>
          </DialogHeader>
          {open && <ExpenseForm towers={towers} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExpenseForm({ towers, onDone }: { towers: { id: string; name: string }[]; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const form = useForm<ExpenseInput, unknown, ExpenseOutput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: "electricity", amount: "", expense_date: todayBaghdad(), tower_id: "", description: "" },
  });
  const err = form.formState.errors;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(undefined);
      const res = await addExpenseAction(values);
      if (res.ok) {
        toast.success(res.message);
        onDone();
      } else setError(res.error);
    }),
  );
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="التصنيف" htmlFor="x-cat" error={err.category?.message} required>
          <NativeSelect id="x-cat" {...form.register("category")}>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="المبلغ (دينار)" htmlFor="x-amount" error={err.amount?.message} required>
          <Input id="x-amount" inputMode="numeric" dir="ltr" {...form.register("amount")} />
        </Field>
        <Field label="التاريخ" htmlFor="x-date" error={err.expense_date?.message} required>
          <Input id="x-date" type="date" dir="ltr" {...form.register("expense_date")} />
        </Field>
        <Field label="البرج" htmlFor="x-tower">
          <NativeSelect id="x-tower" {...form.register("tower_id")}>
            <option value="">عام (كل الأبراج)</option>
            {towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="الوصف" htmlFor="x-desc" error={err.description?.message}>
        <Input id="x-desc" {...form.register("description")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        حفظ المصروف
      </Button>
    </form>
  );
}

export function VoidExpenseButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setOpen(true)}>
        <Undo2 /> إلغاء
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء مصروف</DialogTitle>
            <DialogDescription>{label}. يبقى محفوظاً كـ«ملغى» مع السبب.</DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid gap-1.5">
            <Label htmlFor="xv-reason">سبب الإلغاء</Label>
            <Input id="xv-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const res = await voidExpenseAction({ id, reason });
                if (res.ok) {
                  toast.success(res.message);
                  setOpen(false);
                } else setError(res.error);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            تأكيد الإلغاء
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
