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
