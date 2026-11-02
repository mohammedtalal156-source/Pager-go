"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation/auth";
import {
  adjustDebtSchema,
  correctPaymentSchema,
  createSubscriberSchema,
  datesSchema,
  editSubscriberSchema,
  paymentSchema,
  renewSchema,
  voidSchema,
} from "@/lib/validation/subscriber";

const issue = (e: z.ZodError) => e.issues[0]?.message ?? "بيانات غير صالحة";

function refresh(id?: string) {
  revalidatePath("/subscribers");
  revalidatePath("/");
  if (id) revalidatePath(`/subscribers/${id}`);
}

function dbMessage(message: string) {
  if (message.includes("subscribers_phone")) return "رقم الهاتف غير صحيح";
  return message;
}

export async function createSubscriberAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = createSubscriberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_subscriber", {
    p_full_name: v.full_name,
    p_phone: v.phone,
    p_tower_id: v.tower_id,
    p_package_id: v.package_id,
    p_price: v.price,
    p_start_date: v.start_date,
    p_end_date: v.end_date,
    p_amount_paid: v.amount_paid,
    p_phone2: v.phone2,
    p_area: v.area,
    p_address: v.address,
    p_notes: v.notes,
    p_collector_id: v.collector_id,
    p_request_id: v.request_id,
  });
  if (error) return { ok: false, error: dbMessage(error.message) };
  const id = (data as { id: string }).id;
  refresh(id);
  return { ok: true, data: { id }, message: "تمت إضافة المشترك" };
}

export async function updateSubscriberAction(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = editSubscriberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const { id, ...v } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscribers").update(v).eq("id", id).select("id");
  if (error) return { ok: false, error: dbMessage(error.message) };
  if (!data?.length) return { ok: false, error: "ليست لديك صلاحية تعديل بيانات المشتركين" };
  refresh(id);
  return { ok: true, message: "تم حفظ التعديلات" };
}

export async function setSubscriberArchivedAction(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };
  const { id, archived } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscribers")
    .update({ is_archived: archived, archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "ليست لديك صلاحية أرشفة المشتركين" };
  refresh(id);
  return { ok: true, message: archived ? "تمت أرشفة المشترك" : "تمت استعادة المشترك" };
}

export async function renewAction(input: unknown): Promise<ActionResult<{ end_date: string; balance: number }>> {
  await requireStaff();
  const parsed = renewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_subscription", {
    p_subscriber_id: v.subscriber_id,
    p_periods: v.periods,
    p_price: v.price,
    p_amount_received: v.amount_received,
    p_package_id: v.package_id,
    p_start_override: v.start_override,
    p_request_id: v.request_id,
  });
  if (error) return { ok: false, error: error.message };
  refresh(v.subscriber_id);
  const r = data as { end_date: string; balance: number };
  return { ok: true, data: r, message: "تم التجديد بنجاح" };
}

export async function collectAction(input: unknown): Promise<ActionResult<{ balance: number; receipt_no: number }>> {
  await requireStaff();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    p_subscriber_id: v.subscriber_id,
    p_amount: v.amount,
    p_notes: v.notes,
    p_request_id: v.request_id,
  });
  if (error) return { ok: false, error: error.message };
  refresh(v.subscriber_id);
  return { ok: true, data: data as { balance: number; receipt_no: number }, message: "تم تسجيل الدفعة" };
}

export async function voidPaymentAction(input: unknown, subscriberId: string): Promise<ActionResult> {
  await requireStaff();
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", { p_payment_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: error.message };
  refresh(subscriberId);
  return { ok: true, message: "تم إلغاء الدفعة" };
}

export async function voidRenewalAction(input: unknown, subscriberId: string): Promise<ActionResult> {
  await requireStaff();
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_renewal", { p_renewal_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: error.message };
  refresh(subscriberId);
  return { ok: true, message: "تم إلغاء التجديد" };
}

export async function setDatesAction(input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = datesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_subscriber_dates", {
    p_subscriber_id: v.id,
    p_start_date: v.start_date,
    p_end_date: v.end_date,
    p_reason: v.reason,
  });
  if (error) return { ok: false, error: error.message };
  refresh(v.id);
  return { ok: true, message: "تم تعديل التواريخ" };
}

export async function correctPaymentAction(
  input: unknown,
  subscriberId: string,
): Promise<ActionResult<{ receipt_no: number; balance: number; old_amount?: number; amount: number }>> {
  await requireStaff();
  const parsed = correctPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("correct_payment", {
    p_payment_id: v.id,
    p_amount: v.amount,
    p_reason: v.reason,
    p_request_id: v.request_id,
  });
  if (error) return { ok: false, error: error.message };
  refresh(subscriberId);
  revalidatePath("/finance");
  revalidatePath("/reports");
  return { ok: true, data: data as { receipt_no: number; balance: number; old_amount?: number; amount: number }, message: "تم تصحيح الدفعة" };
}

export type HistoryEntry = {
  id: number;
  occurred_at: string;
  actor_name: string | null;
  action: string;
  table_name: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
};

export async function subscriberHistoryAction(subscriberId: string): Promise<ActionResult<HistoryEntry[]>> {
  await requireStaff();
  if (!z.uuid().safeParse(subscriberId).success) return { ok: false, error: "طلب غير صالح" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subscriber_history", { p_subscriber_id: subscriberId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as HistoryEntry[] };
}

export async function adjustDebtAction(
  input: unknown,
): Promise<ActionResult<{ previous_balance: number; new_balance: number; amount: number; balance: number }>> {
  await requireStaff();
  const parsed = adjustDebtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issue(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_debt", {
    p_subscriber_id: v.subscriber_id,
    p_new_balance: v.new_balance,
    p_expected_balance: v.expected_balance,
    p_reason: v.reason,
    p_request_id: v.request_id,
  });
  if (error) return { ok: false, error: error.message };
  refresh(v.subscriber_id);
  revalidatePath("/finance");
  revalidatePath("/reports");
  return {
    ok: true,
    data: data as { previous_balance: number; new_balance: number; amount: number; balance: number },
    message: "تم تعديل الدين",
  };
}
