import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { requireSection } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTerm } from "@/lib/arabic";
import { formatDate, formatIQD } from "@/lib/utils";
import { can, type Collector, type Package, type SubscriberPerms, type SubscriberRow, type Tower } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { WhatsAppPhone } from "@/components/app/whatsapp-phone";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { Alert } from "@/components/ui/alert";
import { SubscriberSearch } from "./search-bar";
import { SubscriberQuickActions } from "./quick-dialogs";
import { AddSubscriberButton } from "./subscriber-form";

export const metadata: Metadata = { title: "المشتركين" };

const PAGE_SIZE = 50;
const COLUMNS =
  "id, code, full_name, phone, phone2, tower_id, tower_name, area, address, package_id, package_name, price, start_date, end_date, days_left, status, balance, collector_id, notes, is_archived";

type Search = { q?: string; status?: string; tower?: string; page?: string; archived?: string; new?: string };

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireSection("subscribers");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("subscriber_overview")
    .select(COLUMNS, { count: "exact" })
    .eq("is_archived", sp.archived === "1");
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) query = query.ilike("search_text", `%${term}%`);
  if (sp.tower) query = query.eq("tower_id", sp.tower);
  switch (sp.status) {
    case "active":
      query = query.in("status", ["active", "expiring"]);
      break;
    case "expiring":
    case "expired":
    case "none":
      query = query.eq("status", sp.status);
      break;
    case "debt":
      query = query.gt("balance", 0);
      break;
    case "today":
      query = query.eq("days_left", 0);
      break;
    case "tomorrow":
      query = query.eq("days_left", 1);
      break;
    case "in3":
      query = query.eq("days_left", 3);
      break;
  }
  query =
    sp.status === "expiring" || sp.status === "expired"
      ? query.order("end_date", { ascending: sp.status === "expiring" })
      : sp.status === "debt"
        ? query.order("balance", { ascending: false })
        : query.order("full_name");
  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [subsRes, towersRes, packagesRes, collectorsRes] = await Promise.all([
    query.returns<SubscriberRow[]>(),
    supabase.from("towers").select("id, name, area").eq("is_archived", false).order("name").returns<Pick<Tower, "id" | "name" | "area">[]>(),
    supabase.from("packages").select("id, name, price, duration_days, description, is_active").order("price").returns<Package[]>(),
    supabase.rpc("list_collectors"),
  ]);
  const subs = subsRes.data ?? [];
  const total = subsRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lists = {
    towers: towersRes.data ?? [],
    packages: packagesRes.data ?? [],
    collectors: (collectorsRes.data ?? []) as Collector[],
  };
  const perms: SubscriberPerms = {
    create: can(staff, "create_subscribers"),
    edit: can(staff, "edit_subscribers"),
    renew: can(staff, "renew"),
    collect: can(staff, "collect"),
    admin: staff.role === "admin",
  };
  const pageLink = (p: number) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(p));
    next.delete("new");
    return `/subscribers?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={sp.archived === "1" ? "المشتركين المؤرشفين" : "المشتركين"}
        description={`${new Intl.NumberFormat("en-US").format(total)} نتيجة`}
        actions={
          <>
            <Link
              href={sp.archived === "1" ? "/subscribers" : "/subscribers?archived=1"}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent"
            >
              {sp.archived === "1" ? "المشتركين الحاليين" : "المؤرشفين"}
            </Link>
            {perms.create && sp.archived !== "1" && <AddSubscriberButton lists={lists} autoOpen={sp.new === "1"} />}
          </>
        }
      />
      <SubscriberSearch towers={lists.towers} />
      {subsRes.error && <Alert variant="destructive" className="mb-4">{subsRes.error.message}</Alert>}

      {subs.length === 0 ? (
        <EmptyState icon={Users} title={term || sp.status || sp.tower ? "لا توجد نتائج مطابقة" : "لا يوجد مشتركين بعد"} />
      ) : (
        <>
          {/* Phones: cards */}
          <div className="grid gap-2 md:hidden">
            {subs.map((s) => (
              <div key={s.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/subscribers/${s.id}`} className="block truncate font-semibold">
                      {s.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      #{s.code} · {s.tower_name} · <WhatsAppPhone phone={s.phone} />
                    </p>
                  </div>
                  <Link href={`/subscribers/${s.id}`} className="shrink-0">
                    <StatusBadge status={s.status} daysLeft={s.days_left} />
                  </Link>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>ينتهي: {formatDate(s.end_date)}</span>
                  {s.balance > 0 && <span className="font-semibold text-danger">دين {formatIQD(s.balance)}</span>}
                </div>
                <div className="mt-2 border-t pt-2">
                  <SubscriberQuickActions sub={s} packages={lists.packages} perms={perms} lists={lists} compact />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr className="text-start">
                  <th className="p-3 text-start font-medium">الاسم</th>
                  <th className="p-3 text-start font-medium">البرج</th>
                  <th className="p-3 text-start font-medium">الهاتف</th>
                  <th className="p-3 text-start font-medium">انتهاء الاشتراك</th>
                  <th className="p-3 text-start font-medium">الحالة</th>
                  <th className="p-3 text-start font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/30">
                    <td className="p-3">
                      <Link href={`/subscribers/${s.id}`} className="font-medium hover:text-primary">
                        {s.full_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        #{s.code}
                        {s.balance > 0 && <span className="ms-2 font-semibold text-danger">دين {formatIQD(s.balance)}</span>}
                      </div>
                    </td>
                    <td className="p-3">{s.tower_name}</td>
                    <td className="p-3">
                      <WhatsAppPhone phone={s.phone} />
                    </td>
                    <td className="p-3">{formatDate(s.end_date)}</td>
                    <td className="p-3">
                      <StatusBadge status={s.status} daysLeft={s.days_left} />
                    </td>
                    <td className="p-3">
                      <SubscriberQuickActions sub={s} packages={lists.packages} perms={perms} lists={lists} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              {page > 1 && (
                <Link href={pageLink(page - 1)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 hover:bg-accent">
                  <ChevronRight className="size-4" /> السابق
                </Link>
              )}
              <span className="text-muted-foreground">
                صفحة {page} من {pages}
              </span>
              {page < pages && (
                <Link href={pageLink(page + 1)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 hover:bg-accent">
                  التالي <ChevronLeft className="size-4" />
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
