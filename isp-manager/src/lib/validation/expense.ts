import { z } from "zod";
import { money } from "./subscriber";

export const EXPENSE_CATEGORIES = {
  electricity: "كهرباء",
  tower_maintenance: "صيانة الأبراج",
  salaries: "رواتب",
  upstream_internet: "أجور الإنترنت الرئيسي",
  rent: "إيجارات",
  other: "مصروفات أخرى",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const expenseSchema = z.object({
  category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [ExpenseCategory, ...ExpenseCategory[]], { message: "اختر التصنيف" }),
  amount: money.refine((v) => v > 0, "أدخل مبلغاً أكبر من صفر"),
  expense_date: z.iso.date({ message: "أدخل التاريخ" }),
  tower_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable()),
  description: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === "" ? null : v)),
});
export type ExpenseInput = z.input<typeof expenseSchema>;
export type ExpenseOutput = z.output<typeof expenseSchema>;
