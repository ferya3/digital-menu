"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Detector = { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
type JsQR = typeof import("jsqr").default;

// One decoder instance for all frames (re-creating it is slow)
let detector: Detector | null | undefined;
function getDetector(): Detector | null {
  if (detector !== undefined) return detector;
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try { detector = BD ? new BD({ formats: ["qr_code"] }) : null; } catch { detector = null; }
  return detector;
}
let jsqrPromise: Promise<JsQR> | null = null;
const loadJsQR = () => (jsqrPromise ??= import("jsqr").then((m) => m.default));

/** Warm up the decoder (so the first scan doesn't wait for a download) */
export function preloadQr() {
  if (!getDetector()) loadJsQR().catch(() => { jsqrPromise = null; });
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((res, rej) => {
    const t = window.setTimeout(() => rej(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });

/** Decode a QR with jsQR only (software; works on every phone) */
export async function decodeJs(img: ImageData, thorough = false): Promise<string | null> {
  const jsQR = await loadJsQR();
  // Printed QRs are dark on light; inverted codes only on a thorough pass (twice as slow)
  return jsQR(img.data, img.width, img.height, { inversionAttempts: thorough ? "attemptBoth" : "dontInvert" })?.data || null;
}

/** Decode a QR from an image: native decoder (with a timeout), falling back to jsQR */
export async function decodeQr(img: ImageData, thorough = false): Promise<string | null> {
  const det = getDetector();
  if (det) {
    try {
      const r = await withTimeout(det.detect(img), 1200);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch {}
  }
  return decodeJs(img, thorough);
}

/** Table number from the QR text (a link like …/?table=5) */
export function tableFromQr(text: string): string | null {
  try {
    const t = new URL(text, window.location.href).searchParams.get("table");
    if (t) return t.trim().slice(0, 20);
  } catch {}
  const m = text.match(/[?&]table=([^&#\s]+)/);
  return m ? decodeURIComponent(m[1]).slice(0, 20) : null;
}

/** Captured photo → QR text (large photos are downscaled while decoding for speed) */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  // Native decoder directly on the photo
  const det = getDetector();
  let full: ImageBitmap | null = null;
  try { full = await createImageBitmap(file); } catch {}
  if (det && full) {
    try {
      const r = await withTimeout(det.detect(full), 2000);
      if (r[0]?.rawValue) { full.close(); return r[0].rawValue; }
    } catch {}
  }
  const draw = async (max: number, crop = 1): Promise<ImageData | null> => {
    let src: CanvasImageSource | null = full;
    let w = full?.width ?? 0, h = full?.height ?? 0;
    if (!src) {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        src = img; w = img.naturalWidth; h = img.naturalHeight;
      } finally { URL.revokeObjectURL(url); }
    }
    if (!src || !w || !h) return null;
    // crop<1: center of the photo only (where the QR usually is)
    const cw = Math.round(w * crop), ch = Math.round(h * crop);
    const sx = Math.round((w - cw) / 2), sy = Math.round((h - ch) / 2);
    const s = Math.min(1, max / Math.max(cw, ch));
    const c = document.createElement("canvas");
    c.width = Math.round(cw * s); c.height = Math.round(ch * s);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(src, sx, sy, cw, ch, 0, 0, c.width, c.height);
    return ctx.getImageData(0, 0, c.width, c.height);
  };
  try {
    // Cheap to expensive: small full photo, center crop, larger, and finally a thorough pass
    for (const [max, crop, thorough] of [[1000, 1, false], [1000, 0.55, false], [1600, 1, false], [1600, 0.6, true]] as const) {
      const img = await draw(max, crop);
      if (!img) break;
      const text = await decodeQr(img, thorough);
      if (text) return text;
    }
    return null;
  } finally {
    full?.close();
  }
}

/** Live scanning is possible only over HTTPS (or localhost) */
export const canLiveScan = () =>
  typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

/** Is the page open inside an in-app browser (Telegram, Instagram, …)? Returns the app name */
export function inAppBrowser(): string | null {
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook";
  if (/Telegram/i.test(ua)) return "Telegram";
  if (/WhatsApp/i.test(ua)) return "WhatsApp";
  if (/; wv\)/.test(ua)) return "another app";
  return null;
}
/** iPhone / iPad (iPadOS reports itself as a Mac with touch) */
export const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent || "") || (/Macintosh/.test(navigator.userAgent || "") && navigator.maxTouchPoints > 1);
/** Link that opens this page in Chrome (Android) */
export const chromeIntent = () =>
  `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;

/** Live camera scanning (full screen) */
export function LiveScanner({ onResult, onClose, onError, onUsePhoto }: {
  onResult: (text: string) => void; onClose: () => void; onError: (name: string) => void;
  /** Must be called directly inside the user's click (otherwise Chrome blocks the file picker) */
  onUsePhoto: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [seen, setSeen] = useState(0);
  const [engine, setEngine] = useState(getDetector() ? "native" : "jsqr");
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setSlow(true), 6000); return () => window.clearTimeout(t); }, []);
  const [hint, setHint] = useState("Requesting camera access… If you're asked for permission, tap \"Allow\"");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    // If the camera doesn't respond within 8 seconds (no prompt / stuck), report it instead of hanging
    const watchdog = window.setTimeout(() => { if (!stop && !stream) { stop = true; onError("Timeout"); } }, 8000);
    (async () => {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch (e) {
          // Permission denied → rethrow; other errors (old camera / constraints) → retry once with basic settings
          if ((e as Error)?.name === "NotAllowedError" || (e as Error)?.name === "SecurityError") throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        // Continuous focus (if supported) to read close-up QR codes quickly
        try {
          const track = stream.getVideoTracks()[0];
          const caps = (track.getCapabilities?.() || {}) as { focusMode?: string[] };
          if (caps.focusMode?.includes("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
        } catch {}
        window.clearTimeout(watchdog);
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!;
        v.srcObject = stream;
        try {
          await v.play();
        } catch {
          // Some phones reject the first play(); retry once metadata is loaded
          await new Promise((res) => v.addEventListener("loadedmetadata", res, { once: true }));
          await v.play();
        }
        setHint("Fit the QR code on your table inside the frame");
        const det = getDetector();
        loadJsQR().catch(() => {}); // always ready, so a broken native reader causes no delay
        let nativeOk = !!det; // dropped after two errors/timeouts
        let nativeFails = 0;
        let frames = 0;
        const grab = (frac: number, max: number) => {
          // Center square of the frame (the scan box); up to 640px so small/distant QRs are readable
          const side = Math.min(v.videoWidth, v.videoHeight) * frac;
          const out = Math.max(64, Math.min(max, Math.round(side)));
          canvas.width = out; canvas.height = out;
          ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, out, out);
          return ctx.getImageData(0, 0, out, out);
        };
        const tick = async () => {
          if (stop) return;
          if (v.videoWidth) {
            frames++;
            setSeen(frames);
            let text: string | null = null;
            // 1) Native reader (with a timeout; dropped if it errors or hangs)
            if (det && nativeOk) {
              try {
                text = (await withTimeout(det.detect(v), 700))[0]?.rawValue || null;
                nativeFails = 0;
              } catch {
                if (++nativeFails >= 2) { nativeOk = false; setEngine("jsqr"); }
              }
            }
            // 2) jsQR: every frame if there is no working native reader; otherwise every few frames
            if (!text && !stop && (!det || !nativeOk || nativeFails > 0 || frames % 3 === 0)) {
              const thorough = frames % 4 === 0; // occasionally try inverted / low-contrast
              text = await decodeJs(grab(thorough ? 1 : 0.9, 640), thorough).catch(() => null);
            }
            if (text && !stop) {
              stop = true;
              onResult(text);
              return;
            }
          }
          timer = window.setTimeout(tick, 60);
        };
        tick();
      } catch (e) {
        window.clearTimeout(watchdog);
        if (!stop) { stop = true; onError((e as Error)?.name || "Error"); }
      }
    })();
    return () => {
      window.clearTimeout(watchdog);
      stop = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult, onError]);

  return (
    <div className="fixed inset-0 z-[95] bg-black" data-lenis-prevent>
      <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover" />
      {/* Scan frame */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative size-64 rounded-[2rem] shadow-[0_0_0_9999px_rgba(0,0,0,.55)]">
          {["right-0 top-0 border-r-4 border-t-4 rounded-tr-[2rem]", "left-0 top-0 border-l-4 border-t-4 rounded-tl-[2rem]", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-[2rem]", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-[2rem]"].map((c) => (
            <span key={c} className={`absolute size-12 border-white ${c}`} />
          ))}
          <span className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse rounded bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-6 text-center text-white">
        <p className="text-sm font-semibold drop-shadow">{slow && seen > 0 ? "Hold steady, a little closer (6–10 in / 15–25 cm), in good light" : hint}</p>
        <button onClick={onUsePhoto} className="rounded-full border border-white/40 bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur">
          📷 Not working? Take a photo of the QR
        </button>
        <p className="text-[10px] opacity-60">scan: {engine} · frames {seen}</p>
      </div>
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
        <X className="size-6" />
      </button>
    </div>
  );
}
