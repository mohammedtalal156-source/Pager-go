"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PRESET_LABELS } from "@/lib/period";
import { cn } from "@/lib/utils";

export function PeriodFilter({
  preset,
  from,
  to,
  towers,
  showPeriod = true,
}: {
  preset: string;
  from: string;
  to: string;
  towers: { id: string; name: string }[];
  showPeriod?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className="mb-4 grid gap-2 rounded-xl border bg-card p-3">
      {showPeriod && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESET_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => push({ p: key, from: null, to: null })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  preset === key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
            {pending && <Loader2 className="size-5 animate-spin self-center text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">من</span>
            <Input type="date" dir="ltr" className="w-auto" value={from} onChange={(e) => push({ p: "custom", from: e.target.value, to })} />
            <span className="text-muted-foreground">إلى</span>
            <Input type="date" dir="ltr" className="w-auto" value={to} onChange={(e) => push({ p: "custom", from, to: e.target.value })} />
          </div>
        </>
      )}
      {towers.length > 1 && (
        <div className="max-w-xs">
          <NativeSelect value={params.get("tower") ?? ""} onChange={(e) => push({ tower: e.target.value || null })} aria-label="البرج">
            <option value="">كل الأبراج</option>
            {towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}
