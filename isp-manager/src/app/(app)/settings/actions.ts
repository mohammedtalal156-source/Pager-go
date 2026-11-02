"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, ForbiddenError, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/env";
import type { ActionResult } from "@/lib/validation/auth";
import {
  changeOwnPasswordSchema,
  createStaffSchema,
  resetPasswordSchema,
  updateStaffSchema,
} from "@/lib/validation/staff";

const BANNED_FOREVER = "876000h"; // ~100 years

function firstIssue(e: { issues: { message: string }[] }) {
  return e.issues[0]?.message ?? "بيانات غير صالحة";
}

function dbError(message: string) {
  if (message.includes("profiles_username_key") || message.includes("already been registered")) {
    return "اسم المستخدم مستخدم مسبقاً";
  }
  return message;
}

async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Admin creates a staff account (Auth user + profile). */
export async function createStaff(input: unknown) {
  return guard(async () => {
    await assertAdmin();
    const parsed = createStaffSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { password, ...v } = parsed.data;

    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(v.username),
      password,
      email_confirm: true,
      user_metadata: { full_name: v.full_name, username: v.username },
    });
    if (error || !created.user) return { ok: false, error: dbError(error?.message ?? "تعذر إنشاء الحساب") };

    // Insert the profile as the admin user, so RLS (is_admin) is enforced in the DB too.
    const supabase = await createClient();
    const { error: profileError } = await supabase.from("profiles").insert({ id: created.user.id, ...v, is_active: true });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: dbError(profileError.message) };
    }
    revalidatePath("/settings");
    return { ok: true, message: "تم إنشاء الحساب" };
  });
}

export async function updateStaff(input: unknown) {
  return guard(async () => {
    const me = await assertAdmin();
    const parsed = updateStaffSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { id, ...v } = parsed.data;
    if (id === me.id && (!v.is_active || v.role !== "admin")) {
      return { ok: false, error: "لا يمكنك إيقاف حسابك أو إزالة صلاحية المدير عن نفسك" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").update(v).eq("id", id).select("id");
    if (error) return { ok: false, error: dbError(error.message) };
    if (!data?.length) return { ok: false, error: "لم يتم العثور على الحساب أو لا تملك صلاحية تعديله" };

    // Defense in depth: block sign-in for deactivated staff (RLS already blocks data access).
    await createAdminClient().auth.admin.updateUserById(id, { ban_duration: v.is_active ? "none" : BANNED_FOREVER });

    revalidatePath("/settings");
    return { ok: true, message: "تم حفظ التعديلات" };
  });
}

export async function resetStaffPassword(input: unknown) {
  return guard(async () => {
    await assertAdmin();
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const { error } = await createAdminClient().auth.admin.updateUserById(parsed.data.id, {
      password: parsed.data.password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: "تم تغيير كلمة المرور" };
  });
}

export async function changeOwnPassword(input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = changeOwnPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? usernameToEmail(me.username);
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: parsed.data.current });
  if (verifyError) return { ok: false, error: "كلمة المرور الحالية غير صحيحة" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "تم تغيير كلمة المرور" };
}
