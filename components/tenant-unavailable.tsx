/** صفحهٔ «منو در دسترس نیست» (آدرسِ ناموجود یا اشتراکِ تمام‌شده/تعلیق‌شده) */
export function TenantUnavailable({ reason, name }: { reason: "missing" | "inactive"; name?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-muted text-4xl">{reason === "missing" ? "🔎" : "⏳"}</div>
        <h1 className="text-xl font-black">{reason === "missing" ? "منویی با این آدرس پیدا نشد" : `منوی ${name || "این مجموعه"} موقتاً در دسترس نیست`}</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          {reason === "missing"
            ? "آدرس را دوباره بررسی کنید یا QRِ روی میز را اسکن کنید."
            : "لطفاً سفارش‌تان را حضوری ثبت کنید. مدیرِ مجموعه می‌تواند از پنلِ مدیریت، اشتراک را تمدید کند."}
        </p>
      </div>
    </main>
  );
}
