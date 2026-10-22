"use client";

import "./globals.css";

/** Last-resort boundary when the root layout itself fails. Kept dependency-free. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
        <main className="max-w-md">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-1 text-xl font-bold" lang="ar" dir="rtl">
            حدث خطأ ما
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-ink-foreground"
          >
            Try again · حاول مجددًا
          </button>
        </main>
      </body>
    </html>
  );
}
