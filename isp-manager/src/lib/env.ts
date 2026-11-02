import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

/** Public env (safe in the browser). Returns null when not configured yet. */
export function getPublicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

export function requirePublicEnv() {
  const env = getPublicEnv();
  if (!env) {
    throw new Error(
      "Supabase غير مهيأ: أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY إلى ملف .env.local",
    );
  }
  return env;
}

/** Domain used to turn a staff username into the Supabase Auth email. */
export function staffEmailDomain() {
  return process.env.STAFF_EMAIL_DOMAIN || "staff.isp.local";
}

export function usernameToEmail(login: string) {
  const v = login.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${staffEmailDomain()}`;
}
