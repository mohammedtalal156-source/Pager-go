"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

const STATUSES = [
  ["", "الكل"],
  ["active", "فعال"],
  ["expiring", "قريب الانتهاء"],
  ["expired", "منتهي"],
  ["debt", "عليهم ديون"],
] as const;

export function SubscriberSearch({ towers }: { towers: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.delete("new");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Instant search: update the URL 250 ms after the last keystroke.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: q.trim() || null }), 250);
    return () => clearTimeout(timer.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = params.get("status") ?? "";

  return (
    <div className="mb-4 grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف أو رقم المشترك"
          className="h-12 ps-10 pe-10 text-base"
          enterKeyHint="search"
        />
        {pending ? (
          <Loader2 className="absolute end-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          q && (
            <button type="button" aria-label="مسح" onClick={() => setQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="size-5" />
            </button>
          )
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => push({ status: value || null })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                status === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {towers.length > 1 && (
          <div className="min-w-40">
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
    </div>
  );
}
