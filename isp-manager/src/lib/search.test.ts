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
