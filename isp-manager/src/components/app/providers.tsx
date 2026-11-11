"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { RenewalNotice } from "./renewal-notice";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <RenewalNotice />
      <Toaster position="top-center" dir="rtl" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
    </ThemeProvider>
  );
}
