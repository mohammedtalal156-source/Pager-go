"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/env";
import { setupSchema, type ActionResult } from "@/lib/validation/auth";

function tokenMatches(given: string) {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Creates the very first admin. Refused once any staff profile exists. */
export async function createFirstAdmin(input: unknown): Promise<ActionResult> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const v = parsed.data;
  if (!tokenMatches(v.token)) return { ok: false, error: "رمز الإعداد غير صحيح" };

  const admin = createAdminClient();
  const { data: hasStaff, error: checkError } = await admin.rpc("system_has_staff");
  if (checkError) return { ok: false, error: `تعذر الاتصال بقاعدة البيانات: ${checkError.message}` };
  if (hasStaff) return { ok: false, error: "تم إعداد النظام مسبقاً. سجّل الدخول." };

  const email = usernameToEmail(v.username);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.full_name, username: v.username },
  });
  if (createError || !created.user) {
    return { ok: false, error: `تعذر إنشاء الحساب: ${createError?.message ?? "خطأ غير معروف"}` };
  }

  const { error: bootstrapError } = await admin.rpc("bootstrap_first_admin", {
    p_user_id: created.user.id,
    p_username: v.username,
    p_full_name: v.full_name,
  });
  if (bootstrapError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: bootstrapError.message };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password: v.password });
  redirect("/");
}
