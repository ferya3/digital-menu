"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, ImageIcon, X, Save, Store, CreditCard, KeyRound, Clapperboard, Upload, Trash2,
  MapPin, Hash, MessageSquareText, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import { staffSettingsAction, staffTestSmsAction, staffUpdateSettingsAction, type AdminSettings } from "@/app/staff/actions";
import { Field, Panel, Switch, inputCls, isImgSrc, useStaff } from "@/components/staff/kit";
import { unwrap } from "@/lib/action-result";

/** Common ISO 4217 currencies offered in the select ("Other…" allows any 3-letter code) */
const CURRENCIES: [string, string][] = [
  ["USD", "US dollar"], ["EUR", "Euro"], ["GBP", "British pound"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"],
  ["AED", "UAE dirham"], ["SAR", "Saudi riyal"], ["TRY", "Turkish lira"], ["INR", "Indian rupee"], ["JPY", "Japanese yen"],
  ["CHF", "Swiss franc"], ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"], ["DKK", "Danish krone"], ["PLN", "Polish złoty"],
  ["BRL", "Brazilian real"], ["MXN", "Mexican peso"], ["ZAR", "South African rand"], ["NZD", "New Zealand dollar"],
  ["SGD", "Singapore dollar"], ["HKD", "Hong Kong dollar"],
];
const OTHER = "__other";

/** Used when the browser can't list time zones */
const FALLBACK_TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto",
  "America/Mexico_City", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Istanbul", "Africa/Johannesburg",
  "Asia/Dubai", "Asia/Riyadh", "Asia/Kolkata", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Australia/Sydney",
  "Pacific/Auckland",
];
function timeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    const list = fn ? fn("timeZone") : [];
    if (list.length) return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {}
  return FALLBACK_TIMEZONES;
}

export function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const { flash } = useStaff();
  const [s, setS] = useState<AdminSettings | null>(null);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [otherCurrency, setOtherCurrency] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const zones = useMemo(timeZones, []);

  useEffect(() => { staffSettingsAction().then(setS).catch(() => flash("Couldn't load settings")); }, [flash]);
  if (!s) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;

  const cafe = s.cafe, payment = s.payment, sms = s.sms, stripe = s.stripe;
  const setCafe = (p: Partial<AdminSettings["cafe"]>) => setS({ ...s, cafe: { ...cafe, ...p } });
  const setPayment = (p: Partial<AdminSettings["payment"]>) => setS({ ...s, payment: { ...payment, ...p } });
  const setSms = (p: Partial<AdminSettings["sms"]>) => setS({ ...s, sms: { ...sms, ...p } });
  const setStripe = (p: Partial<AdminSettings["stripe"]>) => setS({ ...s, stripe: { ...stripe, ...p } });

  const currency = (cafe.currency || "USD").toUpperCase();
  const isKnownCurrency = CURRENCIES.some(([c]) => c === currency);
  const showOther = otherCurrency || !isKnownCurrency;
  const tz = cafe.timezone || "";

  async function save() {
    const cur = (s!.cafe.currency || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) return flash("❌ Enter a 3-letter currency code, e.g. USD");
    setSaving(true);
    try {
      unwrap(await staffUpdateSettingsAction({
        cafe: { ...cafe, currency: cur, name: cafe.name.trim() || "My Café", logo: cafe.logo || "☕" },
        payment, orderCode: s!.orderCode, sms, stripe: s!.stripe, payFirst: s!.payFirst,
        ...(newPassword.trim() ? { newPassword: newPassword.trim() } : {}),
      }, logoBlob ? imageForm(logoBlob) : null));
      setLogoBlob(null);
      if (newPassword.trim()) setS({ ...s!, hasPassword: true });
      setNewPassword("");
      flash("✅ Settings saved");
      onSaved();
    } catch (e) { flash("❌ Couldn't save: " + (e instanceof Error ? e.message : "Error")); } finally { setSaving(false); }
  }

  const logoPreview = logoUrl || cafe.logo;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      <Panel icon={<Store className="size-5 text-primary" />} title="Business info">
        <div className="flex items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted text-3xl">
            {isImgSrc(logoPreview) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="size-full object-cover" />
            ) : logoPreview || "☕"}
          </span>
          <Field label="Venue name" className="flex-1"><input value={cafe.name} onChange={(e) => setCafe({ name: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Logo (an emoji like ☕ or an image)">
            <div className="flex gap-2">
              <input value={isImgSrc(cafe.logo) ? "" : cafe.logo} onChange={(e) => { setCafe({ logo: e.target.value }); setLogoBlob(null); setLogoUrl(""); }} placeholder="☕" className={inputCls} />
              <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const b = await compressImage(f, 512); setLogoBlob(b); setLogoUrl(URL.createObjectURL(b)); } }} />
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => fileRef.current?.click()} aria-label="Upload logo"><ImageIcon className="size-4" /></Button>
              {(logoUrl || isImgSrc(cafe.logo)) && <Button variant="ghost" size="icon" onClick={() => { setLogoBlob(null); setLogoUrl(""); setCafe({ logo: "☕" }); }} aria-label="Remove logo"><X /></Button>}
            </div>
          </Field>
          <Field label="Tagline (optional)"><input value={cafe.tagline} onChange={(e) => setCafe({ tagline: e.target.value })} className={inputCls} placeholder="e.g. Coffee for special moments" /></Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Currency" hint="Menu prices are shown in this currency">
            <div className="flex gap-2">
              <select
                value={showOther ? OTHER : currency}
                onChange={(e) => {
                  if (e.target.value === OTHER) { setOtherCurrency(true); return; }
                  setOtherCurrency(false);
                  setCafe({ currency: e.target.value });
                }}
                className={inputCls}
              >
                {CURRENCIES.map(([c, name]) => <option key={c} value={c}>{c} — {name}</option>)}
                <option value={OTHER}>Other…</option>
              </select>
              {showOther && (
                <input
                  value={cafe.currency}
                  onChange={(e) => setCafe({ currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })}
                  maxLength={3}
                  placeholder="ISO"
                  aria-label="Currency code"
                  className={cn(inputCls, "w-20 shrink-0 uppercase")}
                />
              )}
            </div>
          </Field>
          <Field label="Time zone" hint="Used for daily and monthly reports">
            <select value={tz} onChange={(e) => setCafe({ timezone: e.target.value })} className={inputCls}>
              <option value="">Server default</option>
              {tz && !zones.includes(tz) && <option value={tz}>{tz}</option>}
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
        </div>
      </Panel>

      <HeroVideoCard video={cafe.heroVideo || ""} onChange={(v) => setS((cur) => (cur ? { ...cur, cafe: { ...cur.cafe, heroVideo: v } } : cur))} flash={flash} />

      <Panel icon={<MapPin className="size-5 text-primary" />} title="Address, contact & Google">
        <p className="mb-3 text-xs text-muted-foreground">Helps when sharing items and makes your menu look better on Google (your name, address, phone and menu are shared with Google as structured data).</p>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City"><input value={cafe.city || ""} onChange={(e) => setCafe({ city: e.target.value })} className={inputCls} placeholder="e.g. Austin" /></Field>
            <Field label="Phone"><input value={cafe.phone || ""} onChange={(e) => setCafe({ phone: e.target.value })} className={inputCls} inputMode="tel" placeholder="+1 555 123 4567" /></Field>
          </div>
          <Field label="Address"><input value={cafe.address || ""} onChange={(e) => setCafe({ address: e.target.value })} className={inputCls} placeholder="e.g. 123 Main St, Austin, TX" /></Field>
          <Field label="Short description for Google (optional)" hint="Up to 160 characters; leave empty to generate it from your name, city and categories">
            <textarea value={cafe.seoDescription || ""} onChange={(e) => setCafe({ seoDescription: e.target.value.slice(0, 160) })} rows={2} className={inputCls} placeholder="e.g. Roya Café — specialty coffee and homemade cakes in downtown Austin" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Map link (Google Maps, Apple Maps…)"><input value={cafe.mapUrl || ""} onChange={(e) => setCafe({ mapUrl: e.target.value })} className={inputCls} placeholder="https://…" /></Field>
            <Field label="Instagram (handle or link)"><input value={cafe.instagram || ""} onChange={(e) => setCafe({ instagram: e.target.value })} className={inputCls} placeholder="@mycafe" /></Field>
          </div>
        </div>
      </Panel>

      <Panel icon={<Hash className="size-5 text-primary" />} title="Order code">
        <Field label="How should order codes be shown?">
          <select value={s.orderCode} onChange={(e) => setS({ ...s, orderCode: e.target.value === "id" ? "id" : "number" })} className={inputCls}>
            <option value="number">Sequential number only (#1, #2 …) — easier to track</option>
            <option value="id">Full code (ord_xxxx)</option>
          </select>
        </Field>
      </Panel>

      <Panel icon={<CreditCard className="size-5 text-primary" />} title="Payments">
        <div className="mb-3 rounded-2xl bg-muted/60 p-3">
          <Switch checked={s.payFirst} onChange={(v) => setS({ ...s, payFirst: v })} label="Pay before preparation (orders go to the kitchen after payment)" />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Orders aren&apos;t sent to the kitchen until payment is confirmed (online, receipt or at the cashier), and the customer is told so. This stops prank orders from outside the venue (e.g. from a photo of the QR code). Unpaid orders are cancelled automatically after 1 hour.
          </p>
        </div>
        <div className="mb-3 space-y-2 rounded-2xl border border-border p-3">
          <div className="text-xs font-bold">Payment options for customers</div>
          <Switch checked={payment.allowCard !== false} onChange={(v) => setPayment({ allowCard: v })} label="🏦 Bank transfer with receipt" />
          <Switch checked={payment.allowPos !== false} onChange={(v) => setPayment({ allowPos: v })} label="🧾 Card reader at the table (the cashier prints the bill and a server brings the card reader)" />
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Bank details are shown to the customer when they ask for the bill; they pay and upload the receipt.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account / IBAN (optional)"><input value={payment.card} onChange={(e) => setPayment({ card: e.target.value })} className={inputCls} placeholder="e.g. GB33 BUKB 2020 1555 5555 55" /></Field>
          <Field label="Account holder"><input value={payment.holder} onChange={(e) => setPayment({ holder: e.target.value })} className={inputCls} placeholder="Full name or business name" /></Field>
          <Field label="Payment link (optional)"><input value={payment.link} onChange={(e) => setPayment({ link: e.target.value })} className={inputCls} placeholder="https://…" /></Field>
          <Field label="Payment note (optional)"><input value={payment.note} onChange={(e) => setPayment({ note: e.target.value })} className={inputCls} placeholder="e.g. Please upload the receipt after paying" /></Field>
        </div>
      </Panel>

      <Panel icon={<Landmark className="size-5 text-primary" />} title="Online payments (Stripe)">
        <div className={cn("rounded-2xl border p-3 transition", stripe.enabled ? "border-primary/40 bg-primary/5" : "border-border")}>
          <Switch checked={stripe.enabled} onChange={(v) => setStripe({ enabled: v })} label="Accept card payments with Stripe" />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Customers pay their table bill by card. Get your key at{" "}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="font-semibold text-primary underline">dashboard.stripe.com/apikeys</a>.
            Optional webhook: <code className="break-all">https://&lt;your-menu-domain&gt;/stripe/webhook</code> (event <code>checkout.session.completed</code>).
          </p>
          {stripe.enabled && (
            <Field label="Secret key" className="mt-3" hint="Stored encrypted. Leave as is to keep the current key.">
              <input type="password" value={stripe.secretKey} onChange={(e) => setStripe({ secretKey: e.target.value })} className={inputCls} placeholder="sk_live_…" autoComplete="new-password" spellCheck={false} />
            </Field>
          )}
        </div>
      </Panel>

      <Panel icon={<MessageSquareText className="size-5 text-primary" />} title="SMS (customer verification)">
        <div className="mb-3 rounded-2xl bg-muted/60 p-3">
          <Switch checked={sms.otpEnabled} onChange={(v) => setSms({ otpEnabled: v })} label="Verify customer phone numbers with an SMS code (before showing the menu)" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">Verified numbers are collected under “Customers” and shown on orders. If the provider is “None”, the code is shown on screen (test mode).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SMS provider" className="sm:col-span-2">
            <select value={sms.provider} onChange={(e) => setSms({ provider: e.target.value === "twilio" ? "twilio" : "none" })} className={inputCls}>
              <option value="none">None (test mode)</option>
              <option value="twilio">Twilio</option>
            </select>
          </Field>
          {sms.provider === "twilio" && (
            <>
              <p className="text-[11px] leading-5 text-muted-foreground sm:col-span-2">
                Find your Account SID and Auth Token in the{" "}
                <a href="https://www.twilio.com/console" target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Twilio Console</a>.
              </p>
              <Field label="Account SID"><input value={sms.accountSid} onChange={(e) => setSms({ accountSid: e.target.value })} className={inputCls} autoComplete="off" spellCheck={false} placeholder="AC…" /></Field>
              <Field label="Auth Token" hint="Leave as is to keep the current token"><input type="password" value={sms.authToken} onChange={(e) => setSms({ authToken: e.target.value })} className={inputCls} autoComplete="new-password" spellCheck={false} /></Field>
              <Field label="Sender" className="sm:col-span-2" hint="Twilio number, alphanumeric sender ID or Messaging Service SID">
                <input value={sms.from} onChange={(e) => setSms({ from: e.target.value })} className={inputCls} autoComplete="off" spellCheck={false} placeholder="+15551234567 or MG…" />
              </Field>
            </>
          )}
        </div>
        {sms.provider !== "none" && <TestSms />}
      </Panel>

      <Panel icon={<KeyRound className="size-5 text-primary" />} title="Admin password">
        <Field label="New password (leave empty to keep the current one)">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="••••••••" autoComplete="new-password" />
        </Field>
        <p className={cn("mt-2 text-xs", s.hasPassword ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}>
          {s.hasPassword ? "✅ A custom password is set" : "⚠️ The password is still the installation default — please change it"}
        </p>
      </Panel>

      <div className="sticky bottom-3 z-10">
        <Button size="lg" className="h-12 w-full rounded-2xl text-base shadow-lg" onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="animate-spin" /> Saving…</> : <><Save className="size-5" /> Save settings</>}
        </Button>
      </div>
    </div>
  );
}

/** Hero video: uploaded directly (not via a Server Action) with a progress bar */
function HeroVideoCard({ video, onChange, flash }: { video: string; onChange: (v: string) => void; flash: (m: string) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);

  function upload(f: File) {
    if (!/^video\/(mp4|webm|quicktime)$/.test(f.type)) return flash("MP4 or WebM videos only");
    if (f.size > 100 * 1024 * 1024) return flash("The video is larger than 100 MB");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/staff/hero-video");
    xhr.setRequestHeader("Content-Type", f.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let r: { ok?: boolean; heroVideo?: string; error?: string; optimizing?: boolean } = {};
      try { r = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 413 && !r.error) r.error = "The file is too large for the server";
      if (r.ok && r.heroVideo) {
        onChange(r.heroVideo);
        flash(r.optimizing ? "Video uploaded ✅ — optimizing it for fast loading (takes a minute or two)" : "Hero video uploaded ✅");
      }
      else flash(r.error || "Video upload failed");
    };
    xhr.onerror = () => { setProgress(null); flash("Connection lost"); };
    setProgress(0);
    xhr.send(f);
  }

  async function optimize() {
    const r = await fetch("/staff/hero-video", { method: "PATCH" }).then((x) => x.json()).catch(() => ({ ok: false }));
    flash(r.ok ? (r.already ? "The video is already optimized ✅" : "Optimization started — ready in a minute or two") : r.error || "Error");
  }

  async function remove() {
    setRemoving(true);
    try {
      const r = await fetch("/staff/hero-video", { method: "DELETE" });
      if (!r.ok) throw new Error();
      onChange("");
      flash("Video removed; the 3D scene is shown instead");
    } catch { flash("Couldn't remove the video"); } finally { setRemoving(false); }
  }

  return (
    <Panel icon={<Clapperboard className="size-5 text-primary" />} title="Home page video (hero)">
      <p className="text-xs text-muted-foreground">
        If you add a video, it plays at the top of the menu instead of the 3D scene (muted and looping). Remove it to bring the 3D scene back.
        Tip: a short landscape MP4 (10–20 seconds) under 20 MB loads fastest.
      </p>
      {video ? (
        <video src={video} muted loop autoPlay playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          The 3D scene is currently shown
        </div>
      )}
      {progress !== null && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: progress + "%" }} /></div>
          <div className="text-center text-xs text-muted-foreground">Uploading… {progress}%</div>
        </div>
      )}
      <input ref={ref} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-xl" disabled={progress !== null} onClick={() => ref.current?.click()}>
          {progress !== null ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />} {video ? "Replace video" : "Upload video"}
        </Button>
        {video && !/-web\.mp4$/.test(video) && (
          <Button variant="outline" className="rounded-xl" disabled={progress !== null} onClick={optimize} title="Compress the video for faster loading">Optimize</Button>
        )}
        {video && (
          <Button variant="outline" className="rounded-xl text-primary" disabled={removing || progress !== null} onClick={remove}>
            {removing ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />} Remove
          </Button>
        )}
      </div>
    </Panel>
  );
}


/** Send a test SMS using the saved settings */
function TestSms() {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; detail: string } | null>(null);
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-border p-3">
      <p className="mb-2 text-xs text-muted-foreground">After saving your settings, send a test SMS to make sure everything works:</p>
      <div className="flex gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" inputMode="tel" className={inputCls} />
        <Button
          variant="outline"
          className="shrink-0 rounded-xl"
          disabled={busy || !phone.trim()}
          onClick={async () => { setBusy(true); setRes(null); try { setRes(await staffTestSmsAction(phone)); } finally { setBusy(false); } }}
        >
          {busy ? <Loader2 className="animate-spin" /> : "Send test"}
        </Button>
      </div>
      {res && <p className={cn("mt-2 rounded-xl px-3 py-2 text-xs", res.ok ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-primary/10 text-primary")}>{res.ok ? "✅ " : "❌ "}{res.detail}</p>}
    </div>
  );
}
