import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetween, describeHistory, parseManualDate, type AuditRow } from "./corrections";
import { correctPaymentSchema, datesSchema, editSubscriberSchema } from "./validation/subscriber";

const UUID = "3f1c1d8e-6a0b-4c55-9a8e-2b7d0f2c1a11";

test("manual dates: common formats become YYYY-MM-DD", () => {
  assert.equal(parseManualDate("2026-12-01"), "2026-12-01");
  assert.equal(parseManualDate("2026/12/1"), "2026-12-01");
  assert.equal(parseManualDate("1/12/2026"), "2026-12-01");
  assert.equal(parseManualDate("01-12-2026"), "2026-12-01");
  assert.equal(parseManualDate("1.12.2026"), "2026-12-01");
  assert.equal(parseManualDate("٠١/١٢/٢٠٢٦"), "2026-12-01");
  assert.equal(parseManualDate(" 29/2/2028 "), "2028-02-29");
});

test("manual dates: impossible dates are rejected", () => {
  for (const v of ["", "abc", "31/2/2026", "29/2/2027", "2026-13-01", "32/1/2026", "1/1/26", "1990-01-01", null, undefined]) {
    assert.equal(parseManualDate(v), null, String(v));
  }
});

test("days between dates", () => {
  assert.equal(daysBetween("2026-11-01", "2026-12-01"), 30);
  assert.equal(daysBetween("2026-12-01", "2026-12-01"), 0);
  assert.equal(daysBetween("2026-02-01", "2026-03-01"), 28);
});

test("payment correction form: browser and server accept the same values", () => {
  const client = correctPaymentSchema.parse({ id: UUID, amount: "15,000", reason: " دفع 15 ألف ", request_id: UUID });
  assert.deepEqual(client, { id: UUID, amount: 15000, reason: "دفع 15 ألف", request_id: UUID });
  assert.deepEqual(correctPaymentSchema.parse(client), client);
  assert.equal(correctPaymentSchema.safeParse({ ...client, amount: 0 }).success, false);
  assert.equal(correctPaymentSchema.safeParse({ ...client, reason: "ab" }).success, false);
});

test("edit and date forms still validate", () => {
  const edit = editSubscriberSchema.parse({
    id: UUID, full_name: "علي حسن", phone: "07701234567", phone2: "", tower_id: UUID, area: "", address: "",
    package_id: "", price: "35,000", collector_id: "", notes: "",
  });
  assert.equal(edit.price, 35000);
  assert.equal(edit.phone2, null);
  assert.deepEqual(editSubscriberSchema.parse(edit), edit);
  const dates = datesSchema.parse({ id: UUID, start_date: "2026-11-01", end_date: "2026-12-01", reason: "تصحيح" });
  assert.deepEqual(datesSchema.parse(dates), dates);
});

test("history: readable entries; balance-only updates hidden", () => {
  const rows: AuditRow[] = [
    { id: 5, occurred_at: "t", actor_name: "المدير", action: "INSERT", table_name: "payments",
      old_data: null, new_data: { receipt_no: 2, amount: 15000, corrects_payment_id: UUID }, reason: "تصحيح مبلغ الوصل #1" },
    { id: 4, occurred_at: "t", actor_name: "المدير", action: "UPDATE", table_name: "payments",
      old_data: { receipt_no: 1, amount: 20000, is_voided: false }, new_data: { receipt_no: 1, amount: 20000, is_voided: true }, reason: "تصحيح مبلغ الوصل #1" },
    { id: 3, occurred_at: "t", actor_name: null, action: "UPDATE", table_name: "subscribers",
      old_data: { total_paid: 20000, full_name: "علي" }, new_data: { total_paid: 15000, full_name: "علي" }, reason: null },
    { id: 2, occurred_at: "t", actor_name: "موظف", action: "UPDATE", table_name: "subscribers",
      old_data: { full_name: "علي", tower_id: "a", price: 25000 }, new_data: { full_name: "علي حسن", tower_id: "b", price: 25000 }, reason: null },
    { id: 1, occurred_at: "t", actor_name: "المدير", action: "UPDATE", table_name: "subscribers",
      old_data: { end_date: "2026-12-01" }, new_data: { end_date: "2026-12-05" }, reason: "تصحيح" },
  ];
  const items = describeHistory(rows, { towers: { a: "برج أ", b: "برج ب" } });
  assert.deepEqual(items.map((i) => i.id), [5, 4, 2, 1]);
  assert.match(items[0].title, /دفعة مصحّحة.*15,000/);
  assert.match(items[1].title, /إلغاء وصل #1.*20,000/);
  assert.deepEqual(items[2].changes, [
    { label: "الاسم", from: "علي", to: "علي حسن" },
    { label: "البرج", from: "برج أ", to: "برج ب" },
  ]);
  assert.equal(items[3].title, "تعديل تواريخ الاشتراك");
  assert.equal(items[3].reason, "تصحيح");
});
