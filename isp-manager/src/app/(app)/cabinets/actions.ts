"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, ForbiddenError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizePole } from "@/lib/pole";
import type { ActionResult } from "@/lib/validation/auth";

async function run(fn: "add_pole" | "remove_pole", raw: unknown, done: (name: string) => string): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    throw e;
  }
  const name = typeof raw === "string" ? normalizePole(raw) : null;
  if (!name || name.length > 50) return { ok: false, error: "اكتب رقم العامود" };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_name: name });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cabinets");
  return { ok: true, message: done(name) };
}

/** Admin: add a pole to «الكابينات». */
export async function addPoleAction(name: unknown): Promise<ActionResult> {
  return run("add_pole", name, (n) => `تمت إضافة عامود ${n}`);
}

/** Admin: remove an empty pole from the list (subscriber data is never touched). */
export async function removePoleAction(name: unknown): Promise<ActionResult> {
  return run("remove_pole", name, (n) => `تم حذف عامود ${n}`);
}
