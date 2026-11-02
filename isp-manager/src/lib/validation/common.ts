import { z } from "zod";

/**
 * Shared field helpers.
 *
 * Every form schema runs TWICE: once in the browser (react-hook-form's
 * zodResolver, which hands its OUTPUT to the server action) and again in the
 * server action. Optional fields therefore must accept their own output:
 * "" (raw form value), null (already-normalised value) and undefined all mean
 * "empty" and become null. Values are trimmed; Arabic-Indic digits become 0-9.
 */

export const toLatinDigits = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** "" | null | undefined → null; otherwise the trimmed string. */
// nullish() (not a union with undefined) keeps the object key optional in Zod 4,
// so a field that is missing entirely is accepted too.
const emptyToNull = z
  .string()
  .nullish()
  .transform((v) => (v == null ? null : v.trim() === "" ? null : v.trim()));

export const optionalText = (max: number) =>
  emptyToNull.refine((v) => v == null || v.length <= max, "النص طويل جداً");

export const optionalPhone = emptyToNull
  .transform((v) => (v == null ? null : toLatinDigits(v).replace(/[\s-]/g, "")))
  .refine((v) => v == null || /^\+?[0-9]{7,15}$/.test(v), "رقم الهاتف غير صحيح");

export const requiredPhone = z
  .string({ message: "رقم الهاتف مطلوب" })
  .trim()
  .transform((v) => toLatinDigits(v).replace(/[\s-]/g, ""))
  .refine((v) => /^\+?[0-9]{7,15}$/.test(v), "رقم الهاتف غير صحيح");

export const optionalUuid = emptyToNull.refine((v) => v == null || z.uuid().safeParse(v).success, "قيمة غير صالحة");

export const optionalDate = emptyToNull.refine((v) => v == null || z.iso.date().safeParse(v).success, "تاريخ غير صحيح");

/** Whole Iraqi dinars. Accepts 25000, "25000", "25,000", "٢٥٠٠٠"; empty → 0. */
export const money = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null || String(v).trim() === "" ? 0 : Number(toLatinDigits(String(v)).replace(/[,\s،]/g, ""))))
  .refine((v) => Number.isInteger(v) && v >= 0 && v <= 1_000_000_000, "أدخل مبلغاً صحيحاً بالدينار");
