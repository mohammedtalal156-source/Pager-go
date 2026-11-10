/**
 * The tower chosen on the home page. It is remembered in a cookie so the
 * subscribers list keeps showing that tower only.
 */
export const CURRENT_TOWER_COOKIE = "current_tower";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A tower id from the URL or the cookie, or null when it is not a valid id. */
export function towerIdOrNull(v: string | null | undefined): string | null {
  return v && UUID.test(v) ? v.toLowerCase() : null;
}

/** The tower to show: the one asked for, else the remembered one, else the only tower. Must be in the list. */
export function resolveTower<T extends { id: string }>(towers: T[], asked: string | null | undefined, remembered: string | null | undefined): T | undefined {
  for (const id of [towerIdOrNull(asked), towerIdOrNull(remembered)]) {
    const t = id ? towers.find((x) => x.id.toLowerCase() === id) : undefined;
    if (t) return t;
  }
  return towers.length === 1 ? towers[0] : undefined;
}
