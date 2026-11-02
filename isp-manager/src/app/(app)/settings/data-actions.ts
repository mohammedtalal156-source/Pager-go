"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, ForbiddenError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseImportFile, type ImportRow } from "@/lib/import";
import type { ActionResult } from "@/lib/validation/auth";

const MAX_BYTES = 4 * 1024 * 1024;

async function admin(): Promise<ActionResult | null> {
  try {
    await assertAdmin();
    return null;
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "متاح للمدير فقط" };
    throw e;
  }
}

/** Step 1: read the Excel file and return a preview (nothing is saved). */
export async function previewImportAction(form: FormData): Promise<ActionResult<{ rows: ImportRow[] }>> {
  const denied = await admin();
  if (denied) return denied as ActionResult<{ rows: ImportRow[] }>;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "اختر ملف Excel" };
  if (file.size > MAX_BYTES) return { ok: false, error: "حجم الملف أكبر من 4 ميغابايت" };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "الملف يجب أن يكون بصيغة ‎.xlsx" };

  let parsed;
  try {
    parsed = await parseImportFile(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "تعذر قراءة الملف. تأكد أنه ملف Excel صالح (.xlsx)" };
  }
  if (parsed.missingColumns.length) return { ok: false, error: `أعمدة مفقودة: ${parsed.missingColumns.join("، ")}` };
  if (parsed.rows.length === 0) return { ok: false, error: "لا توجد صفوف بيانات في الملف" };
  if (parsed.rows.length > 5000) return { ok: false, error: "الحد الأقصى 5000 مشترك في الملف الواحد" };

  const supabase = await createClient();
  const phones = parsed.rows.filter((r) => r.errors.length === 0).map((r) => r.phone);
  if (phones.length) {
    const { data, error } = await supabase.rpc("existing_phones", { p_phones: phones });
    if (error) return { ok: false, error: error.message };
    const existing = new Set((data ?? []) as string[]);
    for (const r of parsed.rows) if (existing.has(r.phone)) r.exists = true;
  }
  return { ok: true, data: { rows: parsed.rows } };
}

const rowSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  phone: z.string().regex(/^\+?\d{7,15}$/),
  tower: z.string().trim().min(1).max(100),
  area: z.string().max(100),
  package: z.string().max(100),
  price: z.number().int().min(0).max(100_000_000),
  start_date: z.union([z.iso.date(), z.literal("")]),
  end_date: z.union([z.iso.date(), z.literal("")]),
  remaining: z.number().int().min(0).max(1_000_000_000),
});

/** Step 2: import the valid rows in one transaction (idempotent per batch). */
export async function confirmImportAction(batchId: string, rows: unknown): Promise<ActionResult<{ inserted: number; skipped: number; towers_created: number }>> {
  const denied = await admin();
  if (denied) return denied as ActionResult<{ inserted: number; skipped: number; towers_created: number }>;
  if (!z.uuid().safeParse(batchId).success) return { ok: false, error: "طلب غير صالح" };
  const parsed = z.array(rowSchema).min(1).max(5000).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "بعض الصفوف غير صالحة. أعد رفع الملف بعد التصحيح." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_subscribers", { p_batch_id: batchId, p_rows: parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/subscribers");
  revalidatePath("/towers");
  revalidatePath("/");
  return { ok: true, data: data as { inserted: number; skipped: number; towers_created: number } };
}

/** Restore a backup file into an EMPTY system (enforced by the database). */
export async function restoreBackupAction(form: FormData): Promise<ActionResult<Record<string, number>>> {
  const denied = await admin();
  if (denied) return denied as ActionResult<Record<string, number>>;
  const file = form.get("file");
  const confirm = String(form.get("confirm") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "اختر ملف النسخة الاحتياطية" };
  if (file.size > MAX_BYTES) return { ok: false, error: "الملف أكبر من 4 ميغابايت؛ استعده عبر SQL Editor في Supabase" };
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "الملف ليس نسخة احتياطية صالحة (JSON)" };
  }
  const supabase = await createClient();
  const { data: res, error } = await supabase.rpc("restore_backup", { p_data: data, p_confirm: confirm });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: res as Record<string, number> };
}
