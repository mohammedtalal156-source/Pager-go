import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Full backup download (admin). JSON: towers, packages, staff, subscribers, periods, payments, renewals, expenses. */
export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "admin") return new Response("Forbidden", { status: 403 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_backup");
  if (error) return new Response(error.message, { status: 500 });
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="isp-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
