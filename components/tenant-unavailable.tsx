/** صفحهٔ «منو در دسترس نیست» (آدرسِ ناموجود یا اشتراکِ تمام‌شده/تعلیق‌شده) */
export interface UnavailableTexts { missingTitle: string; missingText: string; inactiveTitle: string; inactiveText: string }

export function TenantUnavailable({ reason, name, texts }: { reason: "missing" | "inactive"; name?: string; texts?: UnavailableTexts }) {
  const t = (s: string | undefined, d: string) => (s || d).replace(/\{name\}/g, name || "این مجموعه");
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-muted text-4xl">{reason === "missing" ? "🔎" : "⏳"}</div>
        <h1 className="text-xl font-black">{reason === "missing" ? t(texts?.missingTitle, "منویی با این آدرس پیدا نشد") : t(texts?.inactiveTitle, "منوی {name} موقتاً در دسترس نیست")}</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          {reason === "missing"
            ? t(texts?.missingText, "آدرس را دوباره بررسی کنید یا کدِ QR روی میز را اسکن کنید.")
            : t(texts?.inactiveText, "لطفاً سفارش‌تان را حضوری ثبت کنید. مدیرِ مجموعه می‌تواند از پنلِ مدیریت، اشتراک را تمدید کند.")}
        </p>
      </div>
    </main>
  );
}
