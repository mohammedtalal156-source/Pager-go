import { CheckCircle2, XCircle } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { PERMISSION_LABELS, ROLE_LABELS, can, type Permission } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { ComingInPhase } from "@/components/app/coming-in-phase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const staff = await requireStaff();
  const perms = Object.keys(PERMISSION_LABELS) as Permission[];

  return (
    <>
      <PageHeader title={`أهلاً، ${staff.full_name}`} description="لوحة التحكم الرئيسية" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>حسابك</CardTitle>
            <CardDescription>
              <span dir="ltr">@{staff.username}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">الصلاحية:</span>
              <Badge>{ROLE_LABELS[staff.role]}</Badge>
            </div>
            <ul className="grid gap-1.5 text-sm">
              {perms.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  {can(staff, p) ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <XCircle className="size-4 text-muted-foreground" />
                  )}
                  <span className={can(staff, p) ? "" : "text-muted-foreground"}>{PERMISSION_LABELS[p]}</span>
                </li>
              ))}
            </ul>
            {staff.role === "collector" && (
              <p className="text-xs text-muted-foreground">تظهر لك فقط بيانات المشتركين المكلف بتحصيل مبالغهم.</p>
            )}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <ComingInPhase
            phase={2}
            items={[
              "إحصائيات المشتركين والاشتراكات المنتهية والقريبة من الانتهاء",
              "المقبوضات اليوم وهذا الشهر وإجمالي الديون",
              "آخر التجديدات وعمليات التحصيل وأزرار الإجراءات السريعة",
            ]}
          />
        </div>
      </div>
    </>
  );
}
