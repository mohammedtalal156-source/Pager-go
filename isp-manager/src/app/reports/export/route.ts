import ExcelJS from "exceljs";
import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/period";
import { REPORTS, buildReport, type ReportKey } from "@/lib/reports";
import { can } from "@/lib/types";

export const runtime = "nodejs";

/** Excel export of any report. Same permission as the Reports page. */
export async function GET(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) return new Response("Unauthorized", { status: 401 });
  if (!can(staff, "view_finance")) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const key = (REPORTS.find((r) => r.key === sp.r)?.key ?? "daily") as ReportKey;
  const { from, to } = resolvePeriod(sp, key === "monthly" ? "year" : "month");
  const supabase = await createClient();

  let report;
  try {
    report = await buildReport(supabase, key, { from, to }, sp.tower || null);
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "إدارة الأبراج";
  wb.created = new Date();
  const ws = wb.addWorksheet(report.title.slice(0, 31), { views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }] });

  const meta = REPORTS.find((r) => r.key === key)!;
  ws.addRow([report.title]).font = { bold: true, size: 14 };
  ws.addRow([meta.usesPeriod ? `الفترة: ${from} إلى ${to}` : `حتى تاريخ: ${to}`]);
  const header = ws.addRow(report.columns.map((c) => c.label));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    cell.alignment = { horizontal: "center" };
  });

  for (const row of report.rows) {
    ws.addRow(
      report.columns.map((c) => {
        const v = row[c.key];
        if (v == null) return null;
        if (c.type === "money" || c.type === "number") return Number(v);
        if (c.type === "date") return new Date(String(v) + "T00:00:00Z");
        return String(v);
      }),
    );
  }
  if (report.totals) {
    const t = ws.addRow(report.columns.map((c, i) => (i === 0 ? "المجموع" : c.key in report.totals! ? report.totals![c.key] : null)));
    t.font = { bold: true };
  }
  report.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.type === "money" ? 16 : c.key === "full_name" || c.key === "staff_name" || c.key === "tower_name" ? 26 : 14;
    if (c.type === "money" || c.type === "number") col.numFmt = "#,##0";
    if (c.type === "date") col.numFmt = "yyyy-mm-dd";
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `report-${key}-${from}-${to}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
