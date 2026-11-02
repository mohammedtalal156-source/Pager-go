"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { changeOwnPasswordSchema, type ChangeOwnPasswordInput } from "@/lib/validation/staff";
import { changeOwnPassword } from "./actions";

export function OwnPasswordCard() {
  const [pending, startTransition] = useTransition();
  const form = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { current: "", password: "", confirm: "" },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await changeOwnPassword(values);
      if (res.ok) {
        toast.success(res.message);
        form.reset();
      } else toast.error(res.error);
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>تغيير كلمة المرور</CardTitle>
        <CardDescription>لحسابك الشخصي</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3" noValidate>
          <Field label="كلمة المرور الحالية" htmlFor="current" error={err.current?.message}>
            <Input id="current" type="password" dir="ltr" autoComplete="current-password" {...form.register("current")} />
          </Field>
          <Field label="كلمة المرور الجديدة" htmlFor="new-password" error={err.password?.message}>
            <Input id="new-password" type="password" dir="ltr" autoComplete="new-password" {...form.register("password")} />
          </Field>
          <Field label="تأكيد كلمة المرور" htmlFor="confirm-password" error={err.confirm?.message}>
            <Input id="confirm-password" type="password" dir="ltr" autoComplete="new-password" {...form.register("confirm")} />
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
              حفظ كلمة المرور
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
