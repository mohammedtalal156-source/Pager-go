import { z } from "zod";
import { money, optionalPhone, optionalText } from "./common";

/** Package price: same parsing as money, capped lower. */
const price = money.refine((v) => v <= 100_000_000, "أدخل مبلغاً صحيحاً بالدينار");

export const towerSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "اسم البرج مطلوب").max(100),
  area: optionalText(100),
  address: optionalText(200),
  manager_name: optionalText(100),
  manager_phone: optionalPhone,
  notes: optionalText(1000),
});
export type TowerInput = z.input<typeof towerSchema>;
export type TowerOutput = z.output<typeof towerSchema>;

export const packageSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "اسم الباقة مطلوب").max(100),
  price,
  duration_days: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 366, "المدة بين 1 و 366 يوماً"),
  description: optionalText(300),
  is_active: z.boolean(),
});
export type PackageInput = z.input<typeof packageSchema>;
export type PackageOutput = z.output<typeof packageSchema>;
