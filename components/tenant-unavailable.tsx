/** "Menu unavailable" page (unknown address, or expired/suspended subscription) */
export interface UnavailableTexts { missingTitle: string; missingText: string; inactiveTitle: string; inactiveText: string }

export function TenantUnavailable({ reason, name, texts }: { reason: "missing" | "inactive"; name?: string; texts?: UnavailableTexts }) {
  const t = (s: string | undefined, d: string) => (s || d).replace(/\{name\}/g, name || "this venue");
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-muted text-4xl">{reason === "missing" ? "🔎" : "⏳"}</div>
        <h1 className="text-xl font-black">{reason === "missing" ? t(texts?.missingTitle, "We couldn't find a menu at this address") : t(texts?.inactiveTitle, "{name}'s menu is temporarily unavailable")}</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          {reason === "missing"
            ? t(texts?.missingText, "Check the address, or scan the QR code on your table.")
            : t(texts?.inactiveText, "Please place your order with our staff. The venue owner can renew the subscription from the dashboard.")}
        </p>
      </div>
    </main>
  );
}
