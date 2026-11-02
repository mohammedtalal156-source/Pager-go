"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { signIn } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, startTransition] = useTransition();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { login: "", password: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const res = await signIn(values);
      if (res && !res.ok) setError(res.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Field label="اسم المستخدم" htmlFor="login" error={form.formState.errors.login?.message}>
        <Input
          id="login"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="text-left"
          aria-invalid={!!form.formState.errors.login}
          {...form.register("login")}
        />
      </Field>
      <Field label="كلمة المرور" htmlFor="password" error={form.formState.errors.password?.message}>
        <Input
          id="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          className="text-left"
          aria-invalid={!!form.formState.errors.password}
          {...form.register("password")}
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
        تسجيل الدخول
      </Button>
    </form>
  );
}
