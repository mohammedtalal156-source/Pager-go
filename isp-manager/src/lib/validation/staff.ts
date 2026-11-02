import { z } from "zod";
import { passwordSchema, usernameSchema } from "./auth";

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^\+?[0-9]{7,15}$/.test(v), "رقم الهاتف غير صحيح")
  .transform((v) => (v === "" ? null : v));

const permissions = {
  can_create_subscribers: z.boolean(),
  can_edit_subscribers: z.boolean(),
  can_renew: z.boolean(),
  can_collect: z.boolean(),
  can_view_finance: z.boolean(),
};

export const staffRoleSchema = z.enum(["admin", "employee", "collector"]);

export const createStaffSchema = z.object({
  full_name: z.string().trim().min(2, "الاسم قصير جداً").max(100),
  username: usernameSchema,
  phone,
  role: staffRoleSchema,
  password: passwordSchema,
  ...permissions,
});
export type CreateStaffInput = z.input<typeof createStaffSchema>;
export type CreateStaffOutput = z.output<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  id: z.uuid(),
  full_name: z.string().trim().min(2, "الاسم قصير جداً").max(100),
  phone,
  role: staffRoleSchema,
  is_active: z.boolean(),
  ...permissions,
});
export type UpdateStaffInput = z.input<typeof updateStaffSchema>;
export type UpdateStaffOutput = z.output<typeof updateStaffSchema>;

export const resetPasswordSchema = z.object({ id: z.uuid(), password: passwordSchema });

export const changeOwnPasswordSchema = z
  .object({ current: z.string().min(1, "أدخل كلمة المرور الحالية"), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] });
export type ChangeOwnPasswordInput = z.input<typeof changeOwnPasswordSchema>;
