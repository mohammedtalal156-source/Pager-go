import { can, type Profile } from "@/lib/types";

export type NavKey = "home" | "subscribers" | "towers" | "packages" | "finance" | "reports" | "settings";

export type NavItem = { key: NavKey; href: string; label: string };

export const NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/", label: "الرئيسية" },
  { key: "subscribers", href: "/subscribers", label: "المشتركين" },
  { key: "towers", href: "/towers", label: "الأبراج" },
  { key: "packages", href: "/packages", label: "الباقات" },
  { key: "finance", href: "/finance", label: "الحسابات" },
  { key: "reports", href: "/reports", label: "التقارير" },
  { key: "settings", href: "/settings", label: "الإعدادات" },
];

/** Which sections a staff member can open (pages re-check on the server). */
export function canOpen(profile: Profile, key: NavKey): boolean {
  switch (key) {
    case "home":
    case "subscribers":
    case "settings":
      return true;
    case "towers":
    case "packages":
      return profile.role !== "collector";
    case "finance":
    case "reports":
      return can(profile, "view_finance");
  }
}
