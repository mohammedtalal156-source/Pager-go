"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, ForbiddenError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/validation/expense";
import { voidSchema } from "@/lib/validation/subscriber";
import type { ActionResult } from "@/lib/validation/auth";

async function admin() {
  try {
    return await assertAdmin();
  } catch (e) {
    if (e instanceof ForbiddenError) return null;
    throw e;
  }
}

export async function addExpenseAction(input: unknown): Promise<ActionResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "تسجيل المصروفات متاح للمدير فقط" };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({ ...parsed.data, created_by: me.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance");
  revalidatePath("/reports");
  return { ok: true, message: "تم تسجيل المصروف" };
}

export async function voidExpenseAction(input: unknown): Promise<ActionResult> {
  const me = await admin();
  if (!me) return { ok: false, error: "إلغاء المصروفات متاح للمدير فقط" };
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_expense", { p_expense_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance");
  return { ok: true, message: "تم إلغاء المصروف" };
}
