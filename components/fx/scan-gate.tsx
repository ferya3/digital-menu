"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Eye, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveScanner, canLiveScan, chromeIntent, decodeQrFromFile, inAppBrowser, preloadQr, tableFromQr } from "@/components/fx/qr-scanner";
import type { CafeInfo } from "@/lib/types";

const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");

/** بدون شمارهٔ میز: «QR میز خود را اسکن کنید» + اسکن با دوربین + فقط دیدنِ منو */
export function ScanGate({ cafe, onTable }: { cafe: CafeInfo; onTable: (table: string) => void }) {
  const [open, setOpen] = useState(true);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // روی HTTP دوربینِ زنده در دسترس نیست؛ دکمه برنامهٔ دوربین را برای عکس گرفتن باز می‌کند
  const [live0, setLive0] = useState(true);
  useEffect(() => setLive0(canLiveScan()), []);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { if (sessionStorage.getItem("cafe_browse")) setOpen(false); } catch {}
    // دیکودر را از قبل آماده کن تا اولین اسکن منتظرِ دانلود نماند
    preloadQr();
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  const go = useCallback((text: string) => {
    const t = tableFromQr(text);
    if (!t) { setLive(false); setErr("این QR مربوط به میزهای کافه نیست؛ QRِ روی میز را اسکن کنید."); return; }
    setLive(false);
    onTable(t); // بدونِ بارگذاریِ دوبارهٔ صفحه
  }, [onTable]);
  // دوربینِ زنده باز نشد: دلیل و راه‌حل را نشان بده (نه بازکردنِ بی‌صدای برنامهٔ دوربین)
  const [camIssue, setCamIssue] = useState<{ title: string; fix: string; code: string; chrome?: boolean } | null>(null);
  const liveFailed = useCallback((name: string) => {
    setLive(false);
    const app = inAppBrowser();
    if (name === "NotAllowedError" || name === "SecurityError") {
      setCamIssue(app
        ? { title: `این صفحه داخلِ ${app} باز شده و اجازهٔ دوربین ندارد`, fix: "صفحه را در Chrome باز کنید تا دوربین داخلِ سایت کار کند.", code: name, chrome: true }
        : { title: "اجازهٔ دوربین به سایت داده نشده", fix: "روی آیکونِ 🔒 کنارِ آدرسِ سایت بزنید ← «مجوزها» ← «دوربین» ← «اجازه دادن»، بعد دوباره «اسکن QR» را بزنید.", code: name });
    } else if (name === "NotReadableError") {
      setCamIssue({ title: "دوربین دستِ برنامهٔ دیگری است", fix: "برنامه‌هایی که از دوربین استفاده می‌کنند را ببندید و دوباره امتحان کنید.", code: name });
    } else if (name === "NotFoundError") {
      setCamIssue({ title: "دوربینی پیدا نشد", fix: "از دکمهٔ «عکس گرفتن از QR» استفاده کنید.", code: name });
    } else {
      setCamIssue({ title: "دوربینِ زنده باز نشد", fix: app ? "صفحه را در Chrome باز کنید." : "دوباره امتحان کنید یا از QR عکس بگیرید.", code: name, chrome: !!app });
    }
  }, []);
  const closeLive = useCallback(() => setLive(false), []);

  function scan() {
    setErr(""); setCamIssue(null);
    // دوربینِ زنده فقط روی HTTPS؛ روی HTTP دوربینِ گوشی برای گرفتنِ عکس از QR باز می‌شود
    if (canLiveScan()) return setLive(true);
    const app = inAppBrowser();
    if (window.isSecureContext && app) {
      // HTTPS هست ولی مرورگرِ درون‌برنامه‌ای دوربین ندارد
      setCamIssue({ title: `این صفحه داخلِ ${app} باز شده و دوربینِ زنده ندارد`, fix: "صفحه را در Chrome باز کنید تا دوربین داخلِ سایت کار کند.", code: "no-media", chrome: true });
      return;
    }
    fileRef.current?.click();
  }
  async function onPhoto(f: File) {
    setBusy(true); setErr("");
    try {
      const text = await decodeQrFromFile(f);
      if (text) go(text);
      else setErr("QR در عکس پیدا نشد — دوباره، نزدیک‌تر و واضح‌تر عکس بگیرید.");
    } catch { setErr("عکس خوانده نشد؛ دوباره تلاش کنید."); } finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-background p-5" data-lenis-prevent>
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-16 place-items-center overflow-hidden rounded-[1.4rem] bg-card text-4xl shadow-lg ring-1 ring-border">
          {isImg(cafe.logo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cafe.logo + "?w=160"} alt="" className="size-full object-cover" />
          ) : cafe.logo || "☕"}
        </span>
        <h1 className="text-2xl font-black">{cafe.name}</h1>
        <button onClick={scan} className="mx-auto mt-8 grid size-36 place-items-center rounded-[2rem] border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition active:scale-95" aria-label="اسکن QR">
          <QrCode className="size-20" strokeWidth={1.4} />
        </button>
        <h2 className="mt-6 text-xl font-extrabold">QR میز خود را اسکن کنید</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-7 text-muted-foreground">
          {live0
            ? "دکمهٔ زیر را بزنید و دوربین را روی QR کدِ روی میزتان بگیرید تا منوی همان میز باز شود."
            : "سریع‌ترین راه: دوربینِ خودِ گوشی (یا اسکنرِ QR) را روی QR کدِ میز بگیرید و لینک را باز کنید. یا با دکمهٔ زیر از QR عکس بگیرید."}
        </p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(f); }} />
        <Button size="lg" className="mt-6 h-12 w-full max-w-xs rounded-full text-base" onClick={scan} disabled={busy}>
          {busy ? <><Loader2 className="animate-spin" /> در حال خواندنِ QR…</> : <><Camera className="size-5" /> {live0 ? "اسکن QR با دوربین" : "عکس گرفتن از QR میز"}</>}
        </Button>
        {err && <p className="mx-auto mt-3 max-w-xs rounded-xl bg-primary/10 p-2.5 text-sm text-primary">{err}</p>}
        {camIssue && (
          <div className="mx-auto mt-3 max-w-xs rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-right text-sm">
            <p className="font-bold text-amber-900 dark:text-amber-200">⚠️ {camIssue.title}</p>
            <p className="mt-1 text-xs leading-6 text-amber-900/80 dark:text-amber-200/80">{camIssue.fix}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {camIssue.chrome && <a href={chromeIntent()} className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">بازکردن در Chrome</a>}
              <button onClick={() => fileRef.current?.click()} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">📷 عکس گرفتن از QR</button>
              {!camIssue.chrome && <button onClick={scan} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">دوباره امتحان</button>}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground" dir="ltr">code: {camIssue.code}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className="mt-3 rounded-full px-6 text-muted-foreground"
          onClick={() => { try { sessionStorage.setItem("cafe_browse", "1"); } catch {} setOpen(false); }}
        >
          <Eye className="size-4" /> فقط دیدنِ منو
        </Button>
      </div>
      {live && <LiveScanner onResult={go} onClose={closeLive} onError={liveFailed} />}
    </div>
  );
}
