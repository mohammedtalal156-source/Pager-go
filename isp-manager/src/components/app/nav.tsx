"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Home,
  LogOut,
  MoreHorizontal,
  Package,
  RadioTower,
  Settings,
  Users,
  UtilityPole,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem, NavKey } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/app/login/actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const ICONS: Record<NavKey, LucideIcon> = {
  home: Home,
  subscribers: Users,
  cabinets: UtilityPole,
  towers: RadioTower,
  packages: Package,
  finance: Wallet,
  reports: BarChart3,
  settings: Settings,
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ items, userName, roleLabel }: { items: NavItem[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-white/10">
          <RadioTower className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-bold">إدارة الأبراج</p>
          <p className="text-xs opacity-70">نظام داخلي</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent",
                active && "bg-sidebar-accent font-semibold shadow-inner",
              )}
            >
              <Icon className="size-5 opacity-90" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs opacity-70">{roleLabel}</p>
          </div>
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
        </div>
        <form action={signOut}>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="size-4" /> تسجيل الخروج
          </button>
        </form>
      </div>
    </aside>
  );
}

const PRIMARY_MOBILE: NavKey[] = ["home", "subscribers", "cabinets", "towers", "finance"];

export function MobileNav({ items, userName, roleLabel }: { items: NavItem[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = items.filter((i) => PRIMARY_MOBILE.includes(i.key));
  const more = items.filter((i) => !PRIMARY_MOBILE.includes(i.key));
  const moreActive = more.some((i) => isActive(pathname, i.href));

  const tab = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-muted-foreground transition-colors",
      active && "font-semibold text-primary",
    );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl">
          {primary.map((item) => {
            const Icon = ICONS[item.key];
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.key} href={item.href} className={tab(active)}>
                <Icon className="size-6" />
                {item.label}
              </Link>
            );
          })}
          <button type="button" className={tab(moreActive)} onClick={() => setMoreOpen(true)}>
            <MoreHorizontal className="size-6" />
            المزيد
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent>
          <DialogTitle>{userName}</DialogTitle>
          <p className="-mt-3 text-sm text-muted-foreground">{roleLabel}</p>
          <div className="grid grid-cols-3 gap-2">
            {more.map((item) => {
              const Icon = ICONS[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm hover:bg-accent",
                    isActive(pathname, item.href) && "border-primary text-primary",
                  )}
                >
                  <Icon className="size-6" />
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center justify-between rounded-xl border px-3 py-1">
            <span className="text-sm">الوضع الليلي</span>
            <ThemeToggle />
          </div>
          <form action={signOut}>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 py-3 text-sm text-danger hover:bg-danger-soft">
              <LogOut className="size-4" /> تسجيل الخروج
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
