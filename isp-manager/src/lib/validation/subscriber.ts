import { z } from "zod";

const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

export const phoneRequired = z
  .string()
  .trim()
  .transform((v) => latin(v).replace(/[\s-]/g, ""))
  .refine((v) => /^\+?[0-9]{7,15}$/.test(v), "رقم الهاتف غير صحيح");

const phoneOptional = z
  .string()
  .trim()
  .transform((v) => latin(v).replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^\+?[0-9]{7,15}$/.test(v), "رقم الهاتف غير صحيح")
  .transform((v) => (v === "" ? null : v));

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "النص طويل جداً")
    .transform((v) => (v === "" ? null : v));

export const money = z
  .union([z.string(), z.number()])
  .transform((v) => (String(v).trim() === "" ? 0 : Number(latin(String(v)).replace(/[,\s،]/g, ""))))
  .refine((v) => Number.isInteger(v) && v >= 0 && v <= 1_000_000_000, "أدخل مبلغاً صحيحاً بالدينار");

const optionalUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable());

const optionalDate = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date().nullable());

const base = {
  full_name: z.string().trim().min(2, "الاسم مطلوب").max(150),
  phone: phoneRequired,
  phone2: phoneOptional,
  tower_id: z.uuid({ message: "اختر البرج" }),
  area: text(100),
  address: text(200),
  package_id: optionalUuid,
  price: money,
  collector_id: optionalUuid,
  notes: text(1000),
};

export const createSubscriberSchema = z
  .object({
    ...base,
    start_date: optionalDate,
    end_date: optionalDate,
    amount_paid: money,
    request_id: z.uuid(),
  })
  .refine((v) => v.amount_paid <= v.price, { message: "المبلغ المدفوع أكبر من السعر", path: ["amount_paid"] })
  .refine((v) => !v.end_date || !v.start_date || v.end_date >= v.start_date, {
    message: "تاريخ الانتهاء قبل البداية",
    path: ["end_date"],
  });
export type CreateSubscriberInput = z.input<typeof createSubscriberSchema>;
export type CreateSubscriberOutput = z.output<typeof createSubscriberSchema>;

export const editSubscriberSchema = z.object({ id: z.uuid(), ...base });
export type EditSubscriberInput = z.input<typeof editSubscriberSchema>;
export type EditSubscriberOutput = z.output<typeof editSubscriberSchema>;

export const renewSchema = z.object({
  subscriber_id: z.uuid(),
  periods: z.coerce.number().int().min(1).max(24),
  price: money,
  amount_received: money,
  package_id: optionalUuid,
  start_override: optionalDate,
  request_id: z.uuid(),
});

export const paymentSchema = z.object({
  subscriber_id: z.uuid(),
  amount: money.refine((v) => v > 0, "أدخل مبلغاً أكبر من صفر"),
  notes: text(300),
  request_id: z.uuid(),
});

export const voidSchema = z.object({ id: z.uuid(), reason: z.string().trim().min(3, "اكتب سبب الإلغاء").max(300) });

export const datesSchema = z.object({
  id: z.uuid(),
  start_date: optionalDate,
  end_date: optionalDate,
  reason: z.string().trim().min(3, "اكتب سبب التعديل").max(300),
});
