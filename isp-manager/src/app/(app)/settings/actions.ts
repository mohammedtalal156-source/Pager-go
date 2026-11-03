"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, ForbiddenError, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { callStaffAdmin } from "@/lib/staff-admin";
import { usernameToEmail } from "@/lib/env";
import type { ActionResult } from "@/lib/validation/auth";
import {
  changeOwnPasswordSchema,
  createStaffSchema,
  resetPasswordSchema,
  updateStaffSchema,
} from "@/lib/validation/staff";

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

    const created = await callStaffAdmin<{ user_id: string }>(
      "create_user",
      { email: usernameToEmail(v.username), password, username: v.username, full_name: v.full_name },
      { asUser: true },
    );
    if (!created.ok) return { ok: false, error: dbError(created.error) };
    const userId = created.data.user_id;

    // Insert the profile as the admin user, so RLS (is_admin) is enforced in the DB too.
    const supabase = await createClient();
    const { error: profileError } = await supabase.from("profiles").insert({ id: userId, ...v, is_active: true });
    if (profileError) {
      await callStaffAdmin("delete_unlinked_user", { user_id: userId }, { asUser: true });
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
    await callStaffAdmin("set_banned", { user_id: id, banned: !v.is_active }, { asUser: true });

    revalidatePath("/settings");
    return { ok: true, message: "تم حفظ التعديلات" };
  });
}

export async function resetStaffPassword(input: unknown) {
  return guard(async () => {
    await assertAdmin();
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const res = await callStaffAdmin(
      "set_password",
      { user_id: parsed.data.id, password: parsed.data.password },
      { asUser: true },
    );
    if (!res.ok) return { ok: false, error: res.error };
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

/** Admin: the manager phone shown on subscribers' private pages (empty hides it). */
export async function setContactPhone(phone: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    throw e;
  }
  if (typeof phone !== "string" || phone.length > 30) return { ok: false, error: "رقم الهاتف غير صحيح" };
  const digits = phone.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_contact_phone", { p_phone: digits });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: data ? "تم حفظ رقم المدير" : "تم إخفاء الرقم من صفحة المشترك" };
}
