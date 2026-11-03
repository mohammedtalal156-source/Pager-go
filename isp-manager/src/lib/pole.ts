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

/** The pole of a subscriber: the «العامود» field, else «عامود N» written in the name (older subscribers). */
export function poleOf(s: { pole: string | null; search_text: string | null }): string | null {
  if (s.pole) return s.pole;
  const m = /(?:^|\s)(?:ال)?(?:عامود|عمود)\s+([0-9]+[^\s]*)/.exec(s.search_text ?? "");
  return m ? normalizePole(m[1]) : null;
}

export type PoleSummary = { pole: string; count: number; active: number; expired: number; debt: number; towers: string[] };

/** Groups subscribers by pole, sorted 1, 2, 10, 47… */
export function groupByPole(
  rows: { pole: string | null; search_text: string | null; status: string; balance: number; tower_name: string }[],
): { poles: PoleSummary[]; withoutPole: number } {
  const map = new Map<string, PoleSummary>();
  let withoutPole = 0;
  for (const r of rows) {
    const p = poleOf(r);
    if (!p) {
      withoutPole++;
      continue;
    }
    const g = map.get(p) ?? { pole: p, count: 0, active: 0, expired: 0, debt: 0, towers: [] };
    g.count++;
    if (r.status === "active" || r.status === "expiring") g.active++;
    if (r.status === "expired") g.expired++;
    if (r.balance > 0) g.debt += r.balance;
    if (!g.towers.includes(r.tower_name)) g.towers.push(r.tower_name);
    map.set(p, g);
  }
  const poles = [...map.values()].sort((a, b) => a.pole.localeCompare(b.pole, "en", { numeric: true }));
  return { poles, withoutPole };
}
