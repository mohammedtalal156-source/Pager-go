import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "اسم المستخدم: 3-32 حرفاً إنجليزياً أو أرقام أو . _ -");

export const passwordSchema = z
  .string()
  .min(8, "كلمة المرور 8 أحرف على الأقل")
  .max(72, "كلمة المرور طويلة جداً");

export const loginSchema = z.object({
  login: z.string().trim().min(3, "أدخل اسم المستخدم"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const setupSchema = z
  .object({
    token: z.string().min(1, "أدخل رمز الإعداد"),
    full_name: z.string().trim().min(2, "الاسم قصير جداً").max(100),
    username: usernameSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] });
export type SetupInput = z.input<typeof setupSchema>;

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
