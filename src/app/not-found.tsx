import Link from "next/link";
import { arabicFont, latinFont } from "@/lib/fonts";
import { cn } from "@/lib/utils/cn";

/**
 * 404 for paths outside any locale that the proxy did not redirect
 * (e.g. a missing file). Bilingual because no locale is known here.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={cn(latinFont.variable, arabicFont.variable)}>
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
        <main className="max-w-md">
          <p className="text-6xl font-extrabold text-brand">404</p>
          <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
          <p className="mt-1 text-xl font-bold" lang="ar" dir="rtl">
            الصفحة غير موجودة
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/ar" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-ink-foreground" lang="ar">
              الرئيسية
            </Link>
            <Link href="/en" className="rounded-full border border-border-strong px-5 py-3 text-sm font-semibold">
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
