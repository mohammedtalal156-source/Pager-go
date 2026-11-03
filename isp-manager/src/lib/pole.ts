/**
 * «العامود» (pole) helpers. Stored without the word: "47", "12أ".
 * Typed forms accepted: "47", "عامود 47", "عمود47", "٤٧".
 */
const toLatin = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const POLE_WORD = /^(?:ال)?(?:عامود|عمود)\s*/;

export function normalizePole(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = toLatin(v).trim().replace(/\s+/g, " ").replace(POLE_WORD, "").replace(/[",()%_*\\]/g, "").trim();
  return s === "" ? null : s;
}

/**
 * Pulls «عامود N» out of a search so it can match the pole exactly
 * («عامود 4» must not find pole 47). Returns the rest for normal search.
 */
export function extractPole(q: string): { pole: string | null; rest: string } {
  const t = toLatin(q);
  const m = /(?:ال)?(?:عامود|عمود)\s*([0-9]+[^\s]*)/.exec(t);
  if (!m) return { pole: null, rest: q };
  return { pole: normalizePole(m[1]), rest: (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length)).trim() };
}
