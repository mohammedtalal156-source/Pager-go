"use client";

import { useState, useTransition } from "react";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setContactPhone } from "./actions";

/** Admin: the manager phone shown on «رابط المشترك» (tap → WhatsApp). */
export function ContactPhoneCard({ phone }: { phone: string | null }) {
  const [value, setValue] = useState(phone ?? "");
  const [pending, startTransition] = useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await setContactPhone(value.trim());
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>رقم المدير في رابط المشترك</CardTitle>
        <CardDescription>يظهر للمشترك في صفحته، وعند الضغط عليه يفتح محادثة واتساب معك. اتركه فارغاً لإخفائه.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="07XXXXXXXXX"
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            className="h-11"
          />
          <Button type="submit" className="h-11 shrink-0" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Phone />} حفظ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
