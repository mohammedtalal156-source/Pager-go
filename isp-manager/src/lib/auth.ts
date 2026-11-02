import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { canOpen, type NavKey } from "@/components/app/nav-config";

/** The signed-in, ACTIVE staff profile for this request, or null. */
export const getCurrentStaff = cache(async (): Promise<Profile | null> => {
  await connection(); // always per-request
  if (!getPublicEnv()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();
  if (!profile || !profile.is_active) return null;
  return profile;
});

export async function requireStaff(): Promise<Profile> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login?e=noaccess");
  return staff;
}

/** For pages: non-admins are sent home. */
export async function requireAdminPage(): Promise<Profile> {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/");
  return staff;
}

export class ForbiddenError extends Error {
  constructor(message = "ليست لديك صلاحية لهذه العملية") {
    super(message);
  }
}

/** For server actions: throws instead of redirecting. */
export async function assertAdmin(): Promise<Profile> {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "admin") throw new ForbiddenError();
  return staff;
}

/** Server-side gate for a top-level section. */
export async function requireSection(key: NavKey): Promise<Profile> {
  const staff = await requireStaff();
  if (!canOpen(staff, key)) redirect("/");
  return staff;
}
