"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIQD } from "@/lib/utils";
import type { ImportRow } from "@/lib/import";
import { confirmImportAction, previewImportAction, restoreBackupAction } from "./data-actions";

export function ImportCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [batchId, setBatchId] = useState("");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ inserted: number; skipped: number; towers_created: number }>();
  const [pending, startTransition] = useTransition();

  const valid = (rows ?? []).filter((r) => r.errors.length === 0 && !r.exists);
  const existing = (rows ?? []).filter((r) => r.errors.length === 0 && r.exists);
  const invalid = (rows ?? []).filter((r) => r.errors.length > 0);

  const preview = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return setError("اختر ملف Excel أولاً");
    setError(undefined);
    setResult(undefined);
    const fd = new FormData();
    fd.set("file", f);
    startTransition(async () => {
      const res = await previewImportAction(fd);
      if (res.ok) {
        setRows(res.data!.rows);
        setBatchId(crypto.randomUUID());
      } else {
        setRows(null);
        setError(res.error);
      }
    });
  };

  const confirm = () =>
    startTransition(async () => {
      setError(undefined);
      const payload = valid.map(({ full_name, phone, tower, area, package: pkg, price, start_date, end_date, remaining }) => ({
        full_name,
        phone,
        tower,
        area,
        package: pkg,
        price,
        start_date,
        end_date,
        remaining,
      }));
      const res = await confirmImportAction(batchId, payload);
      if (res.ok) {
        setResult(res.data);
        setRows(null);
        if (fileRef.current) fileRef.current.value = "";
        toast.success(`تم استيراد ${res.data!.inserted} مشترك`);
      } else setError(res.error);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-success" /> استيراد المشتركين من Excel
        </CardTitle>
        <CardDescription>
          الأعمدة: الاسم، الهاتف، البرج، المنطقة، الباقة، السعر، تاريخ البداية، تاريخ الانتهاء، المبلغ المتبقي. تُعرض معاينة قبل الحفظ.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <a href="/settings/import-template">
              <Download /> تنزيل نموذج Excel
            </a>
          </Button>
          <Input ref={fileRef} type="file" accept=".xlsx" className="max-w-xs" />
          <Button onClick={preview} disabled={pending}>
            {pending && !rows ? <Loader2 className="animate-spin" /> : <Upload />} معاينة
          </Button>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        {result && (
          <Alert variant="success">
            <CheckCircle2 />
            <div>
              تم استيراد <b>{result.inserted}</b> مشترك
              {result.skipped > 0 && <> · تخطي {result.skipped} (موجودون مسبقاً)</>}
              {result.towers_created > 0 && <> · إنشاء {result.towers_created} برج جديد</>}.
            </div>
          </Alert>
        )}

        {rows && (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="success">جاهز للاستيراد: {valid.length}</Badge>
              <Badge variant="warning">موجود مسبقاً (سيُتخطى): {existing.length}</Badge>
              <Badge variant="danger">فيه أخطاء (لن يُستورد): {invalid.length}</Badge>
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    {["السطر", "الاسم", "الهاتف", "البرج", "الباقة", "السعر", "البداية", "الانتهاء", "المتبقي", "الحالة"].map((h) => (
                      <th key={h} className="whitespace-nowrap p-2 text-start font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? "bg-danger-soft/50" : r.exists ? "bg-warning-soft/50" : ""}>
                      <td className="p-2">{r.line}</td>
                      <td className="whitespace-nowrap p-2">{r.full_name}</td>
                      <td className="p-2" dir="ltr">
                        {r.phone}
                      </td>
                      <td className="whitespace-nowrap p-2">{r.tower}</td>
                      <td className="whitespace-nowrap p-2">{r.package}</td>
                      <td className="whitespace-nowrap p-2">{formatIQD(r.price)}</td>
                      <td className="whitespace-nowrap p-2">{r.start_date}</td>
                      <td className="whitespace-nowrap p-2">{r.end_date}</td>
                      <td className="whitespace-nowrap p-2">{formatIQD(r.remaining)}</td>
                      <td className="p-2">
                        {r.errors.length ? (
                          <span className="text-danger">{r.errors.join("، ")}</span>
                        ) : r.exists ? (
                          <span className="text-warning">موجود مسبقاً</span>
                        ) : (
                          <span className="text-success">جاهز</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              الأبراج غير الموجودة تُنشأ تلقائياً. «المبلغ المتبقي» يُسجَّل ديناً افتتاحياً ولا يُحتسب إيراداً.
            </p>
            <div className="flex gap-2">
              <Button variant="success" size="lg" disabled={pending || valid.length === 0} onClick={confirm}>
                {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                استيراد {valid.length} مشترك
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setRows(null)} disabled={pending}>
                إلغاء
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmWord, setConfirmWord] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const restore = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return setError("اختر ملف النسخة الاحتياطية");
    setError(undefined);
    const fd = new FormData();
    fd.set("file", f);
    fd.set("confirm", confirmWord);
    startTransition(async () => {
      const res = await restoreBackupAction(fd);
      if (res.ok) {
        toast.success(`تمت الاستعادة: ${res.data?.subscribers ?? 0} مشترك`);
        setConfirmWord("");
      } else setError(res.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup className="size-5 text-primary" /> النسخ الاحتياطي والاستعادة
        </CardTitle>
        <CardDescription>
          نزّل نسخة كاملة من كل البيانات (الأبراج، الباقات، المشتركين، الاشتراكات، الدفعات، التجديدات، المصروفات) واحفظها خارج النظام — مثلاً في Google Drive — مرة أسبوعياً على الأقل.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Button asChild size="lg" className="w-fit">
          <a href="/settings/backup">
            <Download /> تنزيل نسخة احتياطية الآن
          </a>
        </Button>
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">استعادة نسخة احتياطية</summary>
          <div className="mt-3 grid gap-3">
            <Alert variant="warning">
              <AlertTriangle />
              <span>الاستعادة تعمل فقط في نظام فارغ (بدون أبراج أو باقات أو مشتركين)، حتى لا تُكتب البيانات فوق بعضها أو تتكرر.</span>
            </Alert>
            {error && <Alert variant="destructive">{error}</Alert>}
            <Input ref={fileRef} type="file" accept=".json,application/json" className="max-w-sm" />
            <div className="grid max-w-sm gap-1.5">
              <Label htmlFor="restore-confirm">للتأكيد اكتب: استعادة</Label>
              <Input id="restore-confirm" value={confirmWord} onChange={(e) => setConfirmWord(e.target.value)} />
            </div>
            <Button variant="destructive" className="w-fit" disabled={pending || confirmWord.trim() !== "استعادة"} onClick={restore}>
              {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} استعادة
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
