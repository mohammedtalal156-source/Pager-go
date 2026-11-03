export type StaffRole = "admin" | "employee" | "collector";

export type Permission = "create_subscribers" | "edit_subscribers" | "renew" | "collect" | "view_finance";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  role: StaffRole;
  is_active: boolean;
  can_create_subscribers: boolean;
  can_edit_subscribers: boolean;
  can_renew: boolean;
  can_collect: boolean;
  can_view_finance: boolean;
  created_at: string;
  updated_at: string;
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "مدير",
  employee: "موظف",
  collector: "محصّل",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  create_subscribers: "إضافة مشتركين",
  edit_subscribers: "تعديل بيانات المشتركين",
  renew: "تجديد الاشتراكات",
  collect: "تسجيل الدفعات",
  view_finance: "عرض الحسابات والتقارير",
};

/**
 * UI-side mirror of public.has_permission(). Used only to hide controls —
 * the database enforces the real rule on every request.
 */
export function can(profile: Pick<Profile, "role" | "is_active" | Exclude<keyof Profile, "id">> | null, perm: Permission) {
  if (!profile || !profile.is_active) return false;
  if (profile.role === "admin") return true;
  switch (perm) {
    case "create_subscribers":
      return profile.role === "employee" && profile.can_create_subscribers;
    case "edit_subscribers":
      return profile.role === "employee" && profile.can_edit_subscribers;
    case "renew":
      return profile.role === "employee" && profile.can_renew;
    case "collect":
      return (profile.role === "employee" || profile.role === "collector") && profile.can_collect;
    case "view_finance":
      return profile.role === "employee" && profile.can_view_finance;
  }
}

export type SubscriptionStatus = "active" | "expiring" | "expired" | "none";

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "فعال",
  expiring: "قريب الانتهاء",
  expired: "منتهي",
  none: "غير فعّال",
};

export type Tower = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  notes: string | null;
  is_archived: boolean;
};

export type TowerStats = {
  tower_id: string;
  subscribers: number;
  active: number;
  expiring: number;
  expired: number;
  debt: number;
  collected_month: number;
};

export type Package = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  description: string | null;
  is_active: boolean;
};

export type DashboardStats = {
  total: number;
  active: number;
  expired: number;
  expiring: number;
  no_subscription: number;
  towers: number;
  collected_today: number;
  collected_month: number;
  debt: number;
  debtors: number;
};

export type SubscriberRow = {
  id: string;
  code: number;
  full_name: string;
  phone: string;
  phone2: string | null;
  tower_id: string;
  tower_name: string;
  pole: string | null;
  area: string | null;
  address: string | null;
  package_id: string | null;
  package_name: string | null;
  price: number;
  start_date: string | null;
  end_date: string | null;
  days_left: number | null;
  status: SubscriptionStatus;
  balance: number;
  collector_id: string | null;
  notes: string | null;
  is_archived: boolean;
};

export type Collector = { id: string; full_name: string; role: StaffRole };

/** Permissions the subscriber screens need on the client (UI only; DB enforces). */
export type SubscriberPerms = {
  create: boolean;
  edit: boolean;
  renew: boolean;
  collect: boolean;
  admin: boolean;
};
