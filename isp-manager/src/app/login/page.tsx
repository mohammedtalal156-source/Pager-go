import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/app/auth-shell";
import { getPublicEnv } from "@/lib/env";
import { getCurrentStaff } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await connection();
  if (!getPublicEnv()) redirect("/setup");
  if (await getCurrentStaff()) redirect("/");
  const { e } = await searchParams;
  const initialError = e === "noaccess" ? "لا يملك هذا الحساب صلاحية الدخول أو أنه موقوف." : undefined;

  return (
    <AuthShell title="إدارة أبراج الإنترنت" subtitle="سجّل دخولك للمتابعة">
      <LoginForm initialError={initialError} />
      <p className="mt-4 text-center text-xs text-muted-foreground">لا يوجد تسجيل عام — الحسابات ينشئها المدير فقط.</p>
    </AuthShell>
  );
}
