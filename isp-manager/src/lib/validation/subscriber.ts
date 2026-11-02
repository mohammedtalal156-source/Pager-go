import { z } from "zod";
import { money, optionalDate, optionalPhone, optionalText, optionalUuid, requiredPhone } from "./common";

export { money };

const base = {
  full_name: z.string().trim().min(2, "الاسم مطلوب").max(150),
  phone: requiredPhone,
  phone2: optionalPhone,
  tower_id: z.uuid({ message: "اختر البرج" }),
  area: optionalText(100),
  address: optionalText(200),
  package_id: optionalUuid,
  price: money.refine((v) => v <= 100_000_000, "أدخل مبلغاً صحيحاً بالدينار"),
  collector_id: optionalUuid,
  notes: optionalText(1000),
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
  notes: optionalText(300),
  request_id: z.uuid(),
});

export const voidSchema = z.object({ id: z.uuid(), reason: z.string().trim().min(3, "اكتب سبب الإلغاء").max(300) });

export const datesSchema = z.object({
  id: z.uuid(),
  start_date: optionalDate,
  end_date: optionalDate,
  reason: z.string().trim().min(3, "اكتب سبب التعديل").max(300),
});
