import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/period";
import { requireCurrentTower } from "@/lib/current-tower-server";
import { REPORTS, buildReport, displayCell, type Report, type ReportKey } from "@/lib/reports";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { PeriodFilter } from "@/components/app/period-filter";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "التقارير" };

type SP = { r?: string; p?: string; from?: string; to?: string; tower?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSection("reports");
  const sp = await searchParams;
  const key = (REPORTS.find((r) => r.key === sp.r)?.key ?? "daily") as ReportKey;
  const meta = REPORTS.find((r) => r.key === key)!;
  const { preset, from, to } = resolvePeriod(sp, key === "monthly" ? "year" : "month");
  const supabase = await createClient();
  const { tower: current } = await requireCurrentTower(supabase, sp.tower);
  const tower = current?.id ?? null;

  let report: Report | null = null;
  let error: string | null = null;
  try {
    report = await buildReport(supabase, key, { from, to }, tower);
  } catch (e) {
    error = (e as Error).message;
  }

  const qs = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return next.toString();
  };
  const exportHref = `/reports/export?${qs({ r: key, p: preset, from, to, tower })}`;

  return (
    <>
      <PageHeader
        title="التقارير"
        description={`${current ? `${current.name} · ` : ""}${meta.usesPeriod ? `${meta.label} · ${formatDate(from)} — ${formatDate(to)}` : `${meta.label} · حتى اليوم`}`}
        actions={
          report && report.rows.length > 0 ? (
            <Button asChild variant="outline">
              <a href={exportHref}>
                <FileSpreadsheet className="text-success" /> تصدير Excel
              </a>
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {REPORTS.map((r) => (
          <Link
            key={r.key}
            href={`/reports?${qs({ r: r.key, p: null, from: null, to: null })}`}
            className={cn("rounded-lg border px-3 py-2 text-sm", r.key === key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <PeriodFilter preset={preset} from={from} to={to} towers={[]} showPeriod={meta.usesPeriod} />
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      {report && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          {report.rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">لا توجد بيانات لهذا التقرير في الفترة المحددة.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  {report.columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap p-3 text-start font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-accent/30">
                    {report!.columns.map((c) => (
                      <td key={c.key} className={cn("whitespace-nowrap p-3", (c.type === "money" || c.type === "number") && "tabular-nums")}>
                        {displayCell(row[c.key], c.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {report.totals && (
                <tfoot className="border-t-2 bg-muted/40 font-bold">
                  <tr>
                    {report.columns.map((c, i) => (
                      <td key={c.key} className="whitespace-nowrap p-3 tabular-nums">
                        {i === 0 ? `المجموع (${report!.rows.length})` : c.key in report!.totals! ? displayCell(report!.totals![c.key], "money") : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}
    </>
  );
}
