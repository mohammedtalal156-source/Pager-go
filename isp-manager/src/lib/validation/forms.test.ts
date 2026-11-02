/**
 * Regression tests for the "expected string, received null" production bug.
 *
 * In the app every form schema runs twice: react-hook-form's zodResolver
 * validates in the browser and passes its OUTPUT to the server action, which
 * validates again with the same schema. `submit()` reproduces exactly that.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { z } from "zod";
import { packageSchema, towerSchema } from "./catalog";
import { expenseSchema } from "./expense";
import { createStaffSchema, updateStaffSchema } from "./staff";
import { createSubscriberSchema, datesSchema, editSubscriberSchema, paymentSchema, renewSchema } from "./subscriber";

const UUID = "3f1c1d8e-6a0b-4c55-9a8e-2b7d0f2c1a11";
const UUID2 = "9a2b7c4d-1e3f-4a5b-8c6d-7e8f9a0b1c2d";

function submit<S extends z.ZodType>(schema: S, formValues: unknown): z.output<S> {
  const client = schema.safeParse(formValues);
  assert.ok(client.success, `browser validation failed: ${JSON.stringify(client.error?.issues)}`);
  const server = schema.safeParse(client.data);
  assert.ok(server.success, `server validation failed: ${JSON.stringify(server.error?.issues)}`);
  assert.deepEqual(server.data, client.data, "server must see exactly what the browser validated");
  return server.data;
}

test("tower: only the name filled (the reported bug)", () => {
  const out = submit(towerSchema, { name: "برج الكرادة", area: "", address: "", manager_name: "", manager_phone: "", notes: "" });
  assert.deepEqual(out, { name: "برج الكرادة", area: null, address: null, manager_name: null, manager_phone: null, notes: null });
});

test("tower: optional fields may be null, undefined or whitespace", () => {
  assert.equal(submit(towerSchema, { name: "برج", area: null, notes: undefined }).area, null);
  assert.equal(submit(towerSchema, { name: "برج", area: "   ", manager_phone: "  " }).manager_phone, null);
  assert.equal(submit(towerSchema, { name: "برج" }).notes, null);
});

test("tower: values are trimmed and phones normalised; bad phone and missing name rejected", () => {
  const out = submit(towerSchema, { name: "  برج  ", area: " الكرادة ", manager_phone: "٠٧٧٠ ١٢٣-٤٥٦٧" });
  assert.equal(out.name, "برج");
  assert.equal(out.area, "الكرادة");
  assert.equal(out.manager_phone, "07701234567");
  assert.equal(towerSchema.safeParse({ name: "برج", manager_phone: "abc" }).success, false);
  assert.equal(towerSchema.safeParse({ name: "  ", area: "" }).success, false);
});

test("package: required only, empty description", () => {
  const out = submit(packageSchema, { name: "باقة 25", price: "25,000", duration_days: "30", description: "", is_active: true });
  assert.equal(out.price, 25000);
  assert.equal(out.duration_days, 30);
  assert.equal(out.description, null);
});

test("expense: general expense (no tower) and no description", () => {
  const out = submit(expenseSchema, { category: "electricity", amount: "50000", expense_date: "2026-11-02", tower_id: "", description: "" });
  assert.equal(out.tower_id, null);
  assert.equal(out.description, null);
  assert.equal(submit(expenseSchema, { category: "rent", amount: 1, expense_date: "2026-11-02", tower_id: UUID, description: " إيجار " }).description, "إيجار");
  assert.equal(expenseSchema.safeParse({ category: "rent", amount: "0", expense_date: "2026-11-02", tower_id: null, description: null }).success, false);
});

test("subscriber create: only required fields", () => {
  const out = submit(createSubscriberSchema, {
    full_name: "أحمد محمد",
    phone: "0770 123 4567",
    phone2: "",
    tower_id: UUID,
    area: "",
    address: "",
    package_id: "",
    price: "",
    start_date: "",
    end_date: "",
    amount_paid: "",
    collector_id: "",
    notes: "",
    request_id: UUID2,
  });
  assert.equal(out.phone, "07701234567");
  for (const k of ["phone2", "area", "address", "package_id", "start_date", "end_date", "collector_id", "notes"] as const) {
    assert.equal(out[k], null, k);
  }
  assert.equal(out.price, 0);
  assert.equal(out.amount_paid, 0);
});

test("subscriber create: full example 25,000 paid 15,000", () => {
  const out = submit(createSubscriberSchema, {
    full_name: "أحمد محمد",
    phone: "07701234567",
    tower_id: UUID,
    package_id: UUID2,
    price: "25000",
    amount_paid: "15000",
    start_date: "2026-11-02",
    end_date: "2026-12-02",
    request_id: UUID2,
  });
  assert.equal(out.price - out.amount_paid, 10000);
  assert.equal(createSubscriberSchema.safeParse({ full_name: "زيد", phone: "07701234567", tower_id: UUID, price: 1000, amount_paid: 2000, request_id: UUID2 }).success, false);
});

test("subscriber edit: optional fields cleared", () => {
  const out = submit(editSubscriberSchema, {
    id: UUID,
    full_name: "فاطمة علي",
    phone: "07801234567",
    phone2: null,
    tower_id: UUID2,
    area: "",
    address: null,
    package_id: "",
    price: "30000",
    collector_id: null,
    notes: "",
  });
  assert.equal(out.collector_id, null);
  assert.equal(out.package_id, null);
});

test("staff: create and update without a phone", () => {
  const perms = { can_create_subscribers: true, can_edit_subscribers: false, can_renew: true, can_collect: true, can_view_finance: false };
  assert.equal(submit(createStaffSchema, { full_name: "علي", username: "Ali", phone: "", role: "employee", password: "12345678", ...perms }).phone, null);
  assert.equal(submit(updateStaffSchema, { id: UUID, full_name: "علي", phone: "", role: "collector", is_active: true, ...perms }).phone, null);
});

test("payment, renewal and date correction accept empty optionals", () => {
  assert.equal(submit(paymentSchema, { subscriber_id: UUID, amount: "4,000", notes: "", request_id: UUID2 }).notes, null);
  assert.equal(submit(paymentSchema, { subscriber_id: UUID, amount: 4000, notes: null, request_id: UUID2 }).amount, 4000);
  const r = submit(renewSchema, { subscriber_id: UUID, periods: 1, price: 25000, amount_received: 25000, package_id: "", start_override: "", request_id: UUID2 });
  assert.equal(r.package_id, null);
  assert.equal(r.start_override, null);
  assert.equal(submit(datesSchema, { id: UUID, start_date: "", end_date: null, reason: "تصحيح" }).end_date, null);
});
