import { requireStaff } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import { NAV_ITEMS, canOpen } from "@/components/app/nav-config";
import { MobileNav, Sidebar } from "@/components/app/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const items = NAV_ITEMS.filter((i) => canOpen(staff, i.key));
  const roleLabel = ROLE_LABELS[staff.role];

  return (
    <div className="flex min-h-dvh">
      <Sidebar items={items} userName={staff.full_name} roleLabel={roleLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <MobileNav items={items} userName={staff.full_name} roleLabel={roleLabel} />
    </div>
  );
}
