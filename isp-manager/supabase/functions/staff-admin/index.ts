// staff-admin — the only place that uses the Supabase service role.
// Runs inside Supabase (the service role key is provided by the platform and
// never leaves it), so the web host needs no secret key.
//
// Actions (POST JSON { action, ... }):
//   status                 → { has_staff }                       (public)
//   bootstrap              → first admin; needs the setup token  (public, one-time)
//   create_user            → auth user for a new staff member    (admin only)
//   delete_unlinked_user   → rollback of create_user if no profile (admin only)
//   set_password           → reset a staff password               (admin only)
//   set_banned             → block / unblock sign-in              (admin only)
// Admin calls carry the caller's access token in the `x-user-jwt` header; the
// caller must be an active admin in public.profiles.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const USERNAME = /^[a-z0-9._-]{3,32}$/;
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BANNED_FOREVER = "876000h";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const fail = (status: number, error: string) => json(status, { error });

function str(v: unknown, min = 1, max = 200): string | null {
  return typeof v === "string" && v.length >= min && v.length <= max ? v : null;
}

function friendly(message: string) {
  if (/already been registered|already exists/i.test(message)) return "اسم المستخدم مستخدم مسبقاً";
  return message;
}

async function requireAdmin(req: Request): Promise<string | Response> {
  const jwt = req.headers.get("x-user-jwt");
  if (!jwt) return fail(401, "غير مسجل الدخول");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return fail(401, "جلسة غير صالحة");
  const { data: p } = await admin.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (!p || p.role !== "admin" || !p.is_active) return fail(403, "ليست لديك صلاحية لهذه العملية");
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method not allowed");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "invalid json");
  }

  switch (body.action) {
    case "status": {
      const { data, error } = await admin.rpc("system_has_staff");
      if (error) return fail(500, error.message);
      return json(200, { has_staff: data === true });
    }

    case "bootstrap": {
      const token = str(body.token, 16, 200);
      const email = str(body.email, 3, 200)?.toLowerCase() ?? null;
      const password = str(body.password, 8, 72);
      const username = str(body.username, 3, 32);
      const fullName = str(body.full_name, 2, 100);
      if (!token || !email || !EMAIL.test(email) || !password || !username || !USERNAME.test(username) || !fullName) {
        return fail(400, "بيانات غير صالحة");
      }
      const { data: ok, error: tokenError } = await admin.rpc("check_setup_token", { p_token: token });
      if (tokenError) return fail(500, tokenError.message);
      if (ok !== true) return fail(403, "رمز الإعداد غير صحيح، أو أن النظام مُعدّ مسبقاً");

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, username },
      });
      if (error || !created.user) return fail(400, friendly(error?.message ?? "تعذر إنشاء الحساب"));
      const { error: bootError } = await admin.rpc("bootstrap_first_admin", {
        p_user_id: created.user.id,
        p_username: username,
        p_full_name: fullName,
      });
      if (bootError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return fail(409, bootError.message);
      }
      return json(200, { ok: true });
    }

    case "create_user": {
      const who = await requireAdmin(req);
      if (who instanceof Response) return who;
      const email = str(body.email, 3, 200)?.toLowerCase() ?? null;
      const password = str(body.password, 8, 72);
      const username = str(body.username, 3, 32);
      const fullName = str(body.full_name, 2, 100);
      if (!email || !EMAIL.test(email) || !password || !username || !USERNAME.test(username) || !fullName) {
        return fail(400, "بيانات غير صالحة");
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, username },
      });
      if (error || !data.user) return fail(400, friendly(error?.message ?? "تعذر إنشاء الحساب"));
      return json(200, { user_id: data.user.id });
    }

    case "delete_unlinked_user": {
      const who = await requireAdmin(req);
      if (who instanceof Response) return who;
      const id = str(body.user_id, 36, 36);
      if (!id || !UUID.test(id)) return fail(400, "بيانات غير صالحة");
      const { data: p } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
      if (p) return fail(409, "لا يمكن حذف حساب مرتبط بموظف");
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return fail(400, error.message);
      return json(200, { ok: true });
    }

    case "set_password": {
      const who = await requireAdmin(req);
      if (who instanceof Response) return who;
      const id = str(body.user_id, 36, 36);
      const password = str(body.password, 8, 72);
      if (!id || !UUID.test(id) || !password) return fail(400, "بيانات غير صالحة");
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return fail(400, error.message);
      return json(200, { ok: true });
    }

    case "set_banned": {
      const who = await requireAdmin(req);
      if (who instanceof Response) return who;
      const id = str(body.user_id, 36, 36);
      if (!id || !UUID.test(id) || typeof body.banned !== "boolean") return fail(400, "بيانات غير صالحة");
      if (id === who) return fail(400, "لا يمكنك إيقاف حسابك");
      const { error } = await admin.auth.admin.updateUserById(id, {
        ban_duration: body.banned ? BANNED_FOREVER : "none",
      });
      if (error) return fail(400, error.message);
      return json(200, { ok: true });
    }

    default:
      return fail(400, "unknown action");
  }
});
