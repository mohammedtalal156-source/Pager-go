import { LinkIcon } from "lucide-react";

export default function LinkNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <LinkIcon className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-bold">الرابط غير صالح</h1>
      <p className="text-sm text-muted-foreground">ربما تم تغيير الرابط. اطلب رابطاً جديداً من مزوّد الإنترنت.</p>
    </main>
  );
}
