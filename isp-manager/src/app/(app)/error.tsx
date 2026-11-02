"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <AlertTriangle className="size-10 text-warning" />
      <h1 className="text-lg font-bold">حدث خطأ غير متوقع</h1>
      <p className="text-sm text-muted-foreground">لم يُحفظ أي شيء ناقص: كل عملية مالية إما تُنفذ كاملة أو لا تُنفذ. أعد المحاولة.</p>
      {error.digest && <p className="text-xs text-muted-foreground" dir="ltr">ref: {error.digest}</p>}
      <Button onClick={reset}>
        <RotateCcw /> إعادة المحاولة
      </Button>
    </div>
  );
}
