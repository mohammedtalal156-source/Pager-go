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
