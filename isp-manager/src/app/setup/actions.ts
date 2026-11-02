"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/env";
import { callStaffAdmin } from "@/lib/staff-admin";
import { setupSchema, type ActionResult } from "@/lib/validation/auth";

/** Creates the very first admin (verified by the staff-admin function + DB). */
export async function createFirstAdmin(input: unknown): Promise<ActionResult> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const v = parsed.data;
  const email = usernameToEmail(v.username);

  const res = await callStaffAdmin("bootstrap", {
    token: v.token,
    email,
    password: v.password,
    username: v.username,
    full_name: v.full_name,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: v.password });
  if (error) redirect("/login");
  redirect("/");
}
