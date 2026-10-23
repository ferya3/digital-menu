"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Eye, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IMAGE_ACCEPT } from "@/lib/client-image";
import { LiveScanner, canLiveScan, chromeIntent, decodeQrFromFile, inAppBrowser, isIOS, preloadQr, tableFromQr } from "@/components/fx/qr-scanner";
import type { CafeInfo } from "@/lib/types";

const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");

/** No table number: "Scan your table's QR code" + camera scan + browse-only option */
export function ScanGate({ cafe, onTable }: { cafe: CafeInfo; onTable: (table: string) => void }) {
  const [open, setOpen] = useState(true);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // No live camera over HTTP; the button opens the camera app to take a photo instead
  const [live0, setLive0] = useState(true);
  useEffect(() => setLive0(canLiveScan()), []);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { if (sessionStorage.getItem("cafe_browse")) setOpen(false); } catch {}
    // Warm up the decoder so the first scan doesn't wait for a download
    preloadQr();
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  const go = useCallback((text: string) => {
    const t = tableFromQr(text);
    if (!t) { setLive(false); setErr("This QR code isn't for a table here. Please scan the QR code on your table."); return; }
    setLive(false);
    onTable(t); // no page reload
  }, [onTable]);
  // Live camera failed: show the reason and a fix (instead of silently opening the camera app)
  const [camIssue, setCamIssue] = useState<{ title: string; fix: string; code: string; chrome?: boolean } | null>(null);
  const liveFailed = useCallback((name: string) => {
    setLive(false);
    const app = inAppBrowser();
    const ios = isIOS();
    // In-app browsers: Android can jump to Chrome directly; on iOS the user opens Safari from the app menu
    const openOut = ios ? "Tap the ••• (or share) menu and choose \"Open in Safari\"." : "Open this page in Chrome so the camera works on the site.";
    // How to re-enable the camera permission for this site
    const allowCam = ios
      ? "Tap \"aA\" in the address bar → Website Settings → Camera → Allow, then tap \"Scan QR\" again. (Or Settings → Safari → Camera.)"
      : "Tap the 🔒 icon next to the address → Permissions → Camera → Allow, then tap \"Scan QR\" again.";
    if (name === "NotAllowedError" || name === "SecurityError") {
      setCamIssue(app
        ? { title: `This page is open inside ${app} and can't use the camera`, fix: openOut, code: name, chrome: !ios }
        : { title: "Camera access is blocked for this site", fix: allowCam, code: name });
    } else if (name === "Timeout") {
      setCamIssue(app
        ? { title: `This page is open inside ${app} and the camera didn't respond`, fix: openOut, code: name, chrome: !ios }
        : { title: "The camera didn't respond", fix: `If no permission prompt appeared: ${allowCam}`, code: name });
    } else if (name === "NotReadableError") {
      setCamIssue({ title: "The camera is being used by another app", fix: "Close any apps using the camera and try again.", code: name });
    } else if (name === "NotFoundError") {
      setCamIssue({ title: "No camera found", fix: "Use \"Take a photo of the QR\" instead.", code: name });
    } else {
      setCamIssue({ title: "Couldn't start the live camera", fix: app ? openOut : "Try again, or take a photo of the QR code.", code: name, chrome: !!app && !ios });
    }
  }, []);
  const closeLive = useCallback(() => setLive(false), []);

  function scan() {
    setErr(""); setCamIssue(null);
    // Live camera needs HTTPS; over HTTP the phone camera opens to take a photo of the QR
    if (canLiveScan()) return setLive(true);
    const app = inAppBrowser();
    if (window.isSecureContext && app) {
      // HTTPS, but the in-app browser has no live camera
      const ios = isIOS();
      setCamIssue({
        title: `This page is open inside ${app}, which doesn't support the live camera`,
        fix: ios ? "Tap the ••• (or share) menu and choose \"Open in Safari\", or take a photo of the QR below." : "Open this page in Chrome so the camera works on the site.",
        code: "no-media",
        chrome: !ios,
      });
      return;
    }
    fileRef.current?.click();
  }
  async function onPhoto(f: File) {
    setBusy(true); setErr("");
    try {
      const text = await decodeQrFromFile(f);
      if (text) go(text);
      else setErr("No QR code found in the photo — try again, a little closer and in focus.");
    } catch { setErr("Couldn't read the photo. Please try again."); } finally { setBusy(false); }
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
        <button onClick={scan} className="mx-auto mt-8 grid size-36 place-items-center rounded-[2rem] border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition active:scale-95" aria-label="Scan QR">
          <QrCode className="size-20" strokeWidth={1.4} />
        </button>
        <h2 className="mt-6 text-xl font-extrabold">Scan your table's QR code</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-7 text-muted-foreground">
          {live0
            ? "Tap the button below and point your camera at the QR code on your table to open its menu."
            : "Quickest way: point your phone's camera app (or any QR scanner) at the table's QR code and open the link. Or take a photo of the QR with the button below."}
        </p>
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(f); }} />
        <Button size="lg" className="mt-6 h-12 w-full max-w-xs rounded-full text-base" onClick={scan} disabled={busy}>
          {busy ? <><Loader2 className="animate-spin" /> Reading QR code…</> : <><Camera className="size-5" /> {live0 ? "Scan QR with camera" : "Take a photo of the table QR"}</>}
        </Button>
        {err && <p className="mx-auto mt-3 max-w-xs rounded-xl bg-primary/10 p-2.5 text-sm text-primary">{err}</p>}
        {camIssue && (
          <div className="mx-auto mt-3 max-w-xs rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm">
            <p className="font-bold text-amber-900 dark:text-amber-200">⚠️ {camIssue.title}</p>
            <p className="mt-1 text-xs leading-6 text-amber-900/80 dark:text-amber-200/80">{camIssue.fix}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {camIssue.chrome && <a href={chromeIntent()} className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Open in Chrome</a>}
              <button onClick={() => fileRef.current?.click()} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">📷 Take a photo of the QR</button>
              {!camIssue.chrome && <button onClick={scan} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">Try again</button>}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">code: {camIssue.code}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className="mt-3 rounded-full px-6 text-muted-foreground"
          onClick={() => { try { sessionStorage.setItem("cafe_browse", "1"); } catch {} setOpen(false); }}
        >
          <Eye className="size-4" /> Just browse the menu
        </Button>
      </div>
      {live && <LiveScanner onResult={go} onClose={closeLive} onError={liveFailed} onUsePhoto={() => { setLive(false); fileRef.current?.click(); }} />}
    </div>
  );
}
