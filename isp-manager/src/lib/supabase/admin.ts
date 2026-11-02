import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnv } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS — use only in server actions AFTER the
 * caller's admin role has been verified (see requireAdmin), or in /setup.
 */
export function createAdminClient() {
  const env = requirePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY غير موجود في متغيرات البيئة على الخادم");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
