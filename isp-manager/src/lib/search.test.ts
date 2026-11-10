import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneCore, searchWords } from "./arabic";

// search_text as stored in the database (normalize_ar of name + phones + code)
const rows = [
  "ابا الحسن علي عامود 47 9647807444064  1030",
  "احمد محسن خلف عامود 29 07702731150  1006",
  "المنتظر هاني عامود 32 9647709212206  1026",
  "زيد +9647701111111  1040",
];
const find = (q: string) => rows.filter((r) => searchWords(q).every((w) => r.includes(w))).length;

test("phone in any format finds the subscriber", () => {
  assert.equal(find("07807444064"), 1, "local form finds 964 form");
  assert.equal(find("9647807444064"), 1);
  assert.equal(find("+9647807444064"), 1);
  assert.equal(find("009647807444064"), 1);
  assert.equal(find("0780 744 4064"), 1, "spaces");
  assert.equal(find("٠٧٨٠٧٤٤٤٠٦٤"), 1, "Arabic digits");
  assert.equal(find("9647702731150"), 1, "964 form finds local form");
  assert.equal(find("07701111111"), 1, "+964 stored");
  assert.equal(find("0780"), 1, "partial");
});

test("several words match in any order", () => {
  assert.equal(find("علي عامود"), 1);
  assert.equal(find("عامود علي"), 1);
  assert.equal(find("عامود"), 3);
  assert.equal(find("احمد 29"), 1);
  assert.equal(find("أحمد"), 1, "hamza normalised");
});

test("subscriber number and edge cases", () => {
  assert.equal(find("1030"), 1, "code search not shortened");
  assert.equal(find("  "), rows.length, "empty search matches all");
  assert.deepEqual(searchWords("علي علي"), ["علي"], "duplicates removed");
  assert.equal(phoneCore("0"), "0");
  assert.equal(phoneCore("964"), "964");
  assert.deepEqual(searchWords("a%b_c"), ["a", "b", "c"], "LIKE wildcards stripped");
});

test("pole: stored without the word, found by «عامود N» exactly", async () => {
  const { normalizePole, extractPole } = await import("./pole");
  assert.equal(normalizePole("47"), "47");
  assert.equal(normalizePole(" عامود 47 "), "47");
  assert.equal(normalizePole("العامود ٤٧"), "47");
  assert.equal(normalizePole("عمود47"), "47");
  assert.equal(normalizePole(""), null);
  assert.equal(normalizePole(null), null);
  assert.deepEqual(extractPole("عامود 47"), { pole: "47", rest: "" });
  assert.deepEqual(extractPole("علي عامود ٤٧"), { pole: "47", rest: "علي" });
  assert.deepEqual(extractPole("عمود47"), { pole: "47", rest: "" });
  assert.deepEqual(extractPole("علي"), { pole: null, rest: "علي" });
  assert.deepEqual(extractPole("عامود"), { pole: null, rest: "عامود" }, "the word alone is a normal search");
});

test("pole in forms: browser and server agree", async () => {
  const { editSubscriberSchema } = await import("./validation/subscriber");
  const UUID = "3f1c1d8e-6a0b-4c55-9a8e-2b7d0f2c1a11";
  const base = { id: UUID, full_name: "علي", phone: "07701234567", phone2: "", tower_id: UUID, area: "", address: "",
    package_id: "", price: "25000", collector_id: "", notes: "" };
  const a = editSubscriberSchema.parse({ ...base, pole: "عامود 47" });
  assert.equal(a.pole, "47");
  assert.deepEqual(editSubscriberSchema.parse(a), a);
  assert.equal(editSubscriberSchema.parse({ ...base, pole: "" }).pole, null);
  assert.equal(editSubscriberSchema.parse(base).pole, null, "old forms without pole still valid");
});

test("cabinets: subscribers grouped by pole (field first, else name)", async () => {
  const { groupByPole, poleOf } = await import("./pole");
  assert.equal(poleOf({ pole: "12", search_text: "علي عامود 47 077" }), "12", "field wins");
  assert.equal(poleOf({ pole: null, search_text: "ابا الحسن علي عامود 47 9647807444064  1030" }), "47");
  assert.equal(poleOf({ pole: null, search_text: "سامر 07701234567  1001" }), null);
  assert.equal(poleOf({ pole: null, search_text: "العامودي حسن 077" }), null, "not a pole word");
  const rows = [
    { pole: null, search_text: "a عامود 47 077", status: "active", balance: 0, tower_name: "برج أ" },
    { pole: "47", search_text: "b 077", status: "expired", balance: 25000, tower_name: "برج أ" },
    { pole: null, search_text: "c عامود 2 077", status: "expiring", balance: 0, tower_name: "برج ب" },
    { pole: "10", search_text: "d 077", status: "none", balance: 0, tower_name: "برج ب" },
    { pole: null, search_text: "e 077", status: "active", balance: 0, tower_name: "برج أ" },
  ];
  const { poles, withoutPole } = groupByPole(rows);
  assert.deepEqual(poles.map((p) => p.pole), ["2", "10", "47"], "numeric order");
  assert.deepEqual(poles[2], { pole: "47", count: 2, active: 1, expired: 1, debt: 25000, towers: ["برج أ"] });
  assert.equal(withoutPole, 1);
});

test("cabinets: listed poles 1..50 show even when empty; used poles always shown", async () => {
  const { mergePoles } = await import("./pole");
  const listed = Array.from({ length: 50 }, (_, i) => String(i + 1)).filter((p) => p !== "3");
  const used = [
    { pole: "7", count: 2, active: 2, expired: 0, debt: 0, towers: ["برج أ"] },
    { pole: "75", count: 1, active: 0, expired: 1, debt: 5000, towers: ["برج ب"] },
  ];
  const cards = mergePoles(listed, used);
  assert.equal(cards.length, 50, "49 listed + pole 75 in use");
  assert.deepEqual(cards.slice(0, 3).map((c) => c.pole), ["1", "2", "4"]);
  assert.equal(cards.at(-1)!.pole, "75");
  assert.equal(cards.find((c) => c.pole === "7")!.removable, false, "pole with subscribers cannot be removed");
  assert.equal(cards.find((c) => c.pole === "8")!.removable, true, "empty pole can be removed");
  assert.equal(cards.find((c) => c.pole === "75")!.removable, false);
});

test("current tower: asked tower, else remembered, else the only one", async () => {
  const { resolveTower, towerIdOrNull } = await import("./current-tower");
  const a = { id: "10000000-0000-0000-0000-00000000000a" };
  const b = { id: "10000000-0000-0000-0000-00000000000b" };
  assert.equal(resolveTower([a, b], b.id, a.id), b, "URL wins");
  assert.equal(resolveTower([a, b], null, a.id), a, "remembered tower");
  assert.equal(resolveTower([a, b], "x", "y"), undefined, "invalid ids: ask again");
  assert.equal(resolveTower([a, b], "10000000-0000-0000-0000-0000000000ff", null), undefined, "unknown/archived tower: ask again");
  assert.equal(resolveTower([a], null, null), a, "single tower opens directly");
  assert.equal(towerIdOrNull("all"), null);
});

test("monthly towers: same day next month, month-end clamped like the database", async () => {
  const { addMonths, periodEnd } = await import("./arabic");
  assert.equal(addMonths("2026-11-11", 1), "2026-12-11");
  assert.equal(addMonths("2026-12-11", 1), "2027-01-11");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-11-11", 2), "2027-01-11");
  assert.equal(periodEnd("2026-11-11", 30, true), "2026-12-11");
  assert.equal(periodEnd("2026-11-11", 30, false), "2026-12-11");
  assert.equal(periodEnd("2026-01-01", 30, true), "2026-02-01");
  assert.equal(periodEnd("2026-01-01", 30, false), "2026-01-31");
});
