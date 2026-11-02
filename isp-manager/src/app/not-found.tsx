import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-bold">الصفحة غير موجودة</h1>
      <Link href="/" className="text-primary underline">
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
