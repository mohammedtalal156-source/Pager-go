import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";
import { CURRENT_TOWER_COOKIE, resolveTower } from "@/lib/current-tower";

type Client = Awaited<ReturnType<typeof createClient>>;
export type TowerRef = { id: string; name: string; area: string | null };

/**
 * The tower chosen on the home page (URL ?tower=… first, then the remembered one).
 * Every page shows that tower only; with no choice yet, the user is sent to the picker.
 */
export async function requireCurrentTower(supabase: Client, asked?: string | null): Promise<{ tower: TowerRef | undefined; towers: TowerRef[] }> {
  const { data } = await supabase.from("towers").select("id, name, area").eq("is_archived", false).order("name").returns<TowerRef[]>();
  const towers = data ?? [];
  const tower = resolveTower(towers, asked, (await cookies()).get(CURRENT_TOWER_COOKIE)?.value);
  if (!tower && towers.length > 1) redirect("/");
  return { tower, towers };
}
