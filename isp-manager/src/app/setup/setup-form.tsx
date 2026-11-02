"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { setupSchema, type SetupInput } from "@/lib/validation/auth";
import { createFirstAdmin } from "./actions";

export function SetupForm() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
    defaultValues: { token: "", full_name: "", username: "", password: "", confirm: "" },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const res = await createFirstAdmin(values);
      if (res && !res.ok) setError(res.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Field label="رمز الإعداد (SETUP_TOKEN)" htmlFor="token" error={err.token?.message} required>
        <Input id="token" type="password" dir="ltr" className="text-left" autoComplete="off" {...form.register("token")} />
      </Field>
      <Field label="الاسم الكامل" htmlFor="full_name" error={err.full_name?.message} required>
        <Input id="full_name" autoComplete="name" {...form.register("full_name")} />
      </Field>
      <Field label="اسم المستخدم" htmlFor="username" error={err.username?.message} hint="بالإنجليزية، مثال: owner" required>
        <Input id="username" dir="ltr" className="text-left" autoCapitalize="none" autoComplete="username" {...form.register("username")} />
      </Field>
      <Field label="كلمة المرور" htmlFor="password" error={err.password?.message} required>
        <Input id="password" type="password" dir="ltr" className="text-left" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="تأكيد كلمة المرور" htmlFor="confirm" error={err.confirm?.message} required>
        <Input id="confirm" type="password" dir="ltr" className="text-left" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        إنشاء حساب المدير
      </Button>
    </form>
  );
}
