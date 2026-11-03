import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { OwnPasswordCard } from "./own-password-card";
import { StaffManager } from "./staff-manager";
import { BackupCard, ImportCard } from "./data-tools";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  const me = await requireStaff();
  let staff: Profile[] = [];
  let loadError: string | null = null;
  if (me.role === "admin") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("is_active", { ascending: false })
      .order("role")
      .order("full_name")
      .returns<Profile[]>();
    staff = data ?? [];
    loadError = error?.message ?? null;
  }

  return (
    <>
      <PageHeader title="الإعدادات" description={me.role === "admin" ? "الموظفون والصلاحيات، الاستيراد، النسخ الاحتياطي، وحسابك" : "إعدادات حسابك"} />
      <div className="grid gap-6">
        {me.role === "admin" && <StaffManager staff={staff} meId={me.id} loadError={loadError} />}
        {me.role === "admin" && <ImportCard />}
        {me.role === "admin" && <BackupCard />}
        <OwnPasswordCard />
      </div>
    </>
  );
}
