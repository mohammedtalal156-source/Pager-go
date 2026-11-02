import "server-only";
import { requirePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Calls the `staff-admin` Supabase Edge Function — the only component that
 * holds the service role. The web app itself never needs a secret key.
 * With `asUser`, the signed-in user's access token is forwarded and the
 * function verifies that user is an active admin.
 */
export async function callStaffAdmin<T = { ok: true }>(
  action: string,
  payload: Record<string, unknown> = {},
  opts: { asUser?: boolean } = {},
): Promise<Result<T>> {
  const env = requirePublicEnv();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  if (opts.asUser) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { ok: false, error: "انتهت الجلسة، سجّل الدخول من جديد" };
    headers["x-user-jwt"] = data.session.access_token;
  }

  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/staff-admin`;
  const body = JSON.stringify({ action, ...payload });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body, cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (res.ok) return { ok: true, data: json };
      // One retry for transient platform errors (e.g. cold start).
      if (res.status >= 500 && attempt === 0) continue;
      return { ok: false, error: json.error ?? `خطأ من الخادم (${res.status})` };
    } catch (e) {
      if (attempt === 0) continue;
      return { ok: false, error: `تعذر الاتصال بخدمة الحسابات: ${(e as Error).message}` };
    }
  }
  return { ok: false, error: "تعذر الاتصال بخدمة الحسابات" };
}
