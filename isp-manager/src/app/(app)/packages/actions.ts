"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, ForbiddenError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { packageSchema } from "@/lib/validation/catalog";
import type { ActionResult } from "@/lib/validation/auth";

function friendly(message: string) {
  if (message.includes("packages_name_key")) return "توجد باقة بنفس الاسم";
  return message;
}

async function admin(): Promise<ActionResult | null> {
  try {
    await assertAdmin();
    return null;
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function savePackage(input: unknown): Promise<ActionResult> {
  const denied = await admin();
  if (denied) return denied;
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const { id, ...v } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("packages").update(v).eq("id", id)
    : await supabase.from("packages").insert(v);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/packages");
  return { ok: true, message: id ? "تم حفظ الباقة" : "تمت إضافة الباقة" };
}

export async function setPackageActive(input: unknown): Promise<ActionResult> {
  const denied = await admin();
  if (denied) return denied;
  const parsed = z.object({ id: z.uuid(), active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };
  const supabase = await createClient();
  const { error } = await supabase.from("packages").update({ is_active: parsed.data.active }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/packages");
  return { ok: true, message: parsed.data.active ? "تم تفعيل الباقة" : "تم إيقاف الباقة" };
}
