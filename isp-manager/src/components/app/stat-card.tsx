import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  default: "bg-primary/10 text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-sm",
        href && "transition-colors hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tabular-nums" dir="ltr" style={{ textAlign: "right" }}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
