import { getCurrentStaff } from "@/lib/auth";
import { buildTemplate } from "@/lib/import";

export const runtime = "nodejs";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "admin") return new Response("Forbidden", { status: 403 });
  const buf = await buildTemplate();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
