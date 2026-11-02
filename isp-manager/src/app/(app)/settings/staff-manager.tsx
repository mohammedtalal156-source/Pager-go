"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Pencil, Phone, Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PERMISSION_LABELS, ROLE_LABELS, can, type Permission, type Profile, type StaffRole } from "@/lib/types";
import {
  createStaffSchema,
  updateStaffSchema,
  type CreateStaffInput,
  type CreateStaffOutput,
  type UpdateStaffInput,
  type UpdateStaffOutput,
} from "@/lib/validation/staff";
import { createStaff, resetStaffPassword, updateStaff } from "./actions";

const PERM_FIELDS: { field: keyof PermissionValues; perm: Permission; roles: StaffRole[] }[] = [
  { field: "can_create_subscribers", perm: "create_subscribers", roles: ["employee"] },
  { field: "can_edit_subscribers", perm: "edit_subscribers", roles: ["employee"] },
  { field: "can_renew", perm: "renew", roles: ["employee"] },
  { field: "can_collect", perm: "collect", roles: ["employee", "collector"] },
  { field: "can_view_finance", perm: "view_finance", roles: ["employee"] },
];

type PermissionValues = {
  can_create_subscribers: boolean;
  can_edit_subscribers: boolean;
  can_renew: boolean;
  can_collect: boolean;
  can_view_finance: boolean;
};

const ROLE_HELP: Record<StaffRole, string> = {
  admin: "كل الصلاحيات: التقارير المالية، الموظفين، الإعدادات.",
  employee: "حسب الصلاحيات المحددة أدناه.",
  collector: "يرى فقط المشتركين المكلف بتحصيل مبالغهم ويسجل دفعاتهم.",
};

export function StaffManager({ staff, meId, loadError }: { staff: Profile[]; meId: string; loadError: string | null }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-5" /> الموظفون والصلاحيات
          </CardTitle>
          <CardDescription className="mt-1">المدير وحده يستطيع إنشاء الحسابات وتعديل الصلاحيات</CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> إضافة موظف
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2">
        {loadError && <Alert variant="destructive">{loadError}</Alert>}
        {staff.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 data-[inactive=true]:opacity-60"
            data-inactive={!p.is_active}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.full_name}</span>
                <Badge variant={p.role === "admin" ? "default" : "secondary"}>{ROLE_LABELS[p.role]}</Badge>
                {!p.is_active && <Badge variant="danger">موقوف</Badge>}
                {p.id === meId && <Badge variant="outline">أنت</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span dir="ltr">@{p.username}</span>
                {p.phone && (
                  <span className="flex items-center gap-1" dir="ltr">
                    <Phone className="size-3" />
                    {p.phone}
                  </span>
                )}
              </div>
              {p.role !== "admin" && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {PERM_FIELDS.filter((f) => f.roles.includes(p.role) && can({ ...p, is_active: true }, f.perm)).map((f) => (
                    <Badge key={f.field} variant="outline" className="font-normal">
                      {PERMISSION_LABELS[f.perm]}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
              <Pencil /> تعديل
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موظف</DialogTitle>
            <DialogDescription>ينشئ حساب دخول جديد. أعطِ الموظف اسم المستخدم وكلمة المرور.</DialogDescription>
          </DialogHeader>
          {createOpen && <CreateStaffForm onDone={() => setCreateOpen(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل: {editing?.full_name}</DialogTitle>
            <DialogDescription dir="ltr" className="text-end">
              @{editing?.username}
            </DialogDescription>
          </DialogHeader>
          {editing && <EditStaffForm key={editing.id} profile={editing} isMe={editing.id === meId} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PermissionSwitches({ control, role }: { control: Control<PermissionValues>; role: StaffRole }) {
  if (role === "admin") {
    return <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{ROLE_HELP.admin}</p>;
  }
  return (
    <div className="grid gap-1 rounded-xl border p-3">
      <p className="mb-1 text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
      {PERM_FIELDS.filter((f) => f.roles.includes(role)).map((f) => (
        <Controller
          key={f.field}
          control={control}
          name={f.field}
          render={({ field }) => (
            <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
              {PERMISSION_LABELS[f.perm]}
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      ))}
    </div>
  );
}

function CreateStaffForm({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const form = useForm<CreateStaffInput, unknown, CreateStaffOutput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      full_name: "",
      username: "",
      phone: "",
      role: "employee",
      password: "",
      can_create_subscribers: true,
      can_edit_subscribers: false,
      can_renew: true,
      can_collect: true,
      can_view_finance: false,
    },
  });
  const err = form.formState.errors;
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(undefined);
      const res = await createStaff(values);
      if (res.ok) {
        toast.success(res.message);
        onDone();
      } else setError(res.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Field label="الاسم الكامل" htmlFor="s-name" error={err.full_name?.message} required>
        <Input id="s-name" {...form.register("full_name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المستخدم" htmlFor="s-username" error={err.username?.message} hint="بالإنجليزية، مثال: ali" required>
          <Input id="s-username" dir="ltr" autoCapitalize="none" autoComplete="off" {...form.register("username")} />
        </Field>
        <Field label="كلمة المرور" htmlFor="s-password" error={err.password?.message} required>
          <Input id="s-password" type="text" dir="ltr" autoComplete="new-password" {...form.register("password")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم الهاتف" htmlFor="s-phone" error={err.phone?.message}>
          <Input id="s-phone" type="tel" inputMode="tel" dir="ltr" {...form.register("phone")} />
        </Field>
        <Field label="نوع الحساب" htmlFor="s-role" error={err.role?.message} required>
          <NativeSelect id="s-role" {...form.register("role")}>
            <option value="employee">{ROLE_LABELS.employee}</option>
            <option value="collector">{ROLE_LABELS.collector}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </NativeSelect>
        </Field>
      </div>
      <PermissionSwitches control={form.control as unknown as Control<PermissionValues>} role={role} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        إنشاء الحساب
      </Button>
    </form>
  );
}

function EditStaffForm({ profile, isMe, onDone }: { profile: Profile; isMe: boolean; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const form = useForm<UpdateStaffInput, unknown, UpdateStaffOutput>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      id: profile.id,
      full_name: profile.full_name,
      phone: profile.phone ?? "",
      role: profile.role,
      is_active: profile.is_active,
      can_create_subscribers: profile.can_create_subscribers,
      can_edit_subscribers: profile.can_edit_subscribers,
      can_renew: profile.can_renew,
      can_collect: profile.can_collect,
      can_view_finance: profile.can_view_finance,
    },
  });
  const err = form.formState.errors;
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(undefined);
      const res = await updateStaff(values);
      if (res.ok) {
        toast.success(res.message);
        onDone();
      } else setError(res.error);
    }),
  );

  return (
    <div className="grid gap-5">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {error && <Alert variant="destructive">{error}</Alert>}
        <Field label="الاسم الكامل" htmlFor="e-name" error={err.full_name?.message} required>
          <Input id="e-name" {...form.register("full_name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم الهاتف" htmlFor="e-phone" error={err.phone?.message}>
            <Input id="e-phone" type="tel" inputMode="tel" dir="ltr" {...form.register("phone")} />
          </Field>
          <Field label="نوع الحساب" htmlFor="e-role" required>
            <NativeSelect id="e-role" disabled={isMe} {...form.register("role")}>
              <option value="employee">{ROLE_LABELS.employee}</option>
              <option value="collector">{ROLE_LABELS.collector}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </NativeSelect>
          </Field>
        </div>
        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <span>
                الحساب فعّال
                <span className="block text-xs text-muted-foreground">إيقاف الحساب يمنع الدخول فوراً ويحتفظ بسجله المالي</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isMe} />
            </label>
          )}
        />
        <PermissionSwitches control={form.control as unknown as Control<PermissionValues>} role={role} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          حفظ التعديلات
        </Button>
      </form>
      {!isMe && <ResetPassword id={profile.id} />}
    </div>
  );
}

function ResetPassword({ id }: { id: string }) {
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2 rounded-xl border border-dashed p-3">
      <p className="text-sm font-medium">تعيين كلمة مرور جديدة</p>
      <div className="flex gap-2">
        <Input
          type="text"
          dir="ltr"
          placeholder="8 أحرف على الأقل"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending || password.length < 8}
          onClick={() =>
            startTransition(async () => {
              const res = await resetStaffPassword({ id, password });
              if (res.ok) {
                toast.success(res.message);
                setPassword("");
              } else toast.error(res.error);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          تعيين
        </Button>
      </div>
    </div>
  );
}
