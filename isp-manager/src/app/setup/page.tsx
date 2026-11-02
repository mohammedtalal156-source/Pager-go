import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AlertTriangle } from "lucide-react";
import { AuthShell } from "@/components/app/auth-shell";
import { Alert } from "@/components/ui/alert";
import { getPublicEnv } from "@/lib/env";
import { callStaffAdmin } from "@/lib/staff-admin";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "الإعداد الأولي" };

function Missing({ items }: { items: string[] }) {
  return (
    <AuthShell title="الإعداد الأولي" subtitle="النظام غير مربوط بقاعدة البيانات بعد">
      <Alert variant="warning">
        <AlertTriangle />
        <div className="grid gap-2">
          <p>أضف متغيرات البيئة التالية على الخادم ثم أعد تشغيل التطبيق:</p>
          <ul className="list-inside list-disc font-mono text-xs" dir="ltr">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </Alert>
    </AuthShell>
  );
}

export default async function SetupPage() {
  await connection();
  const missing: string[] = [];
  if (!getPublicEnv()) missing.push("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (missing.length) return <Missing items={missing} />;

  const status = await callStaffAdmin<{ has_staff: boolean }>("status");
  if (!status.ok) {
    return (
      <AuthShell title="الإعداد الأولي">
        <Alert variant="destructive">
          تعذر الاتصال بقاعدة البيانات أو بخدمة الحسابات: {status.error}
        </Alert>
      </AuthShell>
    );
  }
  if (status.data.has_staff) redirect("/login");

  return (
    <AuthShell title="الإعداد الأولي" subtitle="إنشاء حساب المدير الأول — تظهر هذه الصفحة مرة واحدة فقط">
      <SetupForm />
    </AuthShell>
  );
}
