import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type SubscriptionStatus } from "@/lib/types";

const VARIANT = { active: "success", expiring: "warning", expired: "danger", none: "secondary" } as const;

export function StatusBadge({ status, daysLeft }: { status: SubscriptionStatus; daysLeft?: number | null }) {
  let label = STATUS_LABELS[status];
  if (status === "expiring" && daysLeft != null) {
    label = daysLeft === 0 ? "ينتهي اليوم" : daysLeft === 1 ? "ينتهي غداً" : `باقي ${daysLeft} أيام`;
  }
  return <Badge variant={VARIANT[status]}>{label}</Badge>;
}
