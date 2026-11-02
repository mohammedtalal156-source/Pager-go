"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, ForbiddenError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { towerSchema } from "@/lib/validation/catalog";
import type { ActionResult } from "@/lib/validation/auth";

function friendly(message: string) {
  if (message.includes("towers_name_active_key")) return "يوجد برج فعّال بنفس الاسم";
  return message;
}

/** Create or update a tower (admin only; also enforced by RLS). */
export async function saveTower(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    throw e;
  }
  const parsed = towerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const { id, ...v } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("towers").update(v).eq("id", id)
    : await supabase.from("towers").insert(v);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/towers");
  revalidatePath("/");
  return { ok: true, message: id ? "تم حفظ التعديلات" : "تمت إضافة البرج" };
}

export async function setTowerArchived(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    throw e;
  }
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };
  const { id, archived } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("towers")
    .update({ is_archived: archived, archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/towers");
  revalidatePath("/");
  return { ok: true, message: archived ? "تمت أرشفة البرج" : "تمت استعادة البرج" };
}
