"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Detector = { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
type JsQR = typeof import("jsqr").default;

// یک نمونهٔ دیکودر برای همهٔ فریم‌ها (ساختنِ مکرر کند است)
let detector: Detector | null | undefined;
function getDetector(): Detector | null {
  if (detector !== undefined) return detector;
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try { detector = BD ? new BD({ formats: ["qr_code"] }) : null; } catch { detector = null; }
  return detector;
}
let jsqrPromise: Promise<JsQR> | null = null;
const loadJsQR = () => (jsqrPromise ??= import("jsqr").then((m) => m.default));

/** آماده‌سازیِ دیکودر از قبل (تا اولین اسکن منتظرِ دانلود نماند) */
export function preloadQr() {
  if (!getDetector()) loadJsQR().catch(() => { jsqrPromise = null; });
}

/** خواندنِ QR از یک تصویر: اول دیکودرِ خودِ گوشی (BarcodeDetector)، وگرنه jsQR */
export async function decodeQr(img: ImageData, thorough = false): Promise<string | null> {
  const det = getDetector();
  if (det) {
    try {
      const r = await det.detect(img);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch {}
  }
  const jsQR = await loadJsQR();
  // QRِ چاپی تیره روی زمینهٔ روشن است؛ حالتِ برعکس فقط در تلاشِ کامل (دو برابر کندتر)
  return jsQR(img.data, img.width, img.height, { inversionAttempts: thorough ? "attemptBoth" : "dontInvert" })?.data || null;
}

/** شمارهٔ میز از متنِ QR (لینکِ …/?table=۵) */
export function tableFromQr(text: string): string | null {
  try {
    const t = new URL(text, window.location.href).searchParams.get("table");
    if (t) return t.trim().slice(0, 20);
  } catch {}
  const m = text.match(/[?&]table=([^&#\s]+)/);
  return m ? decodeURIComponent(m[1]).slice(0, 20) : null;
}

/** عکسِ گرفته‌شده → متنِ QR (عکسِ ۱۲ مگاپیکسلی هنگامِ خواندن کوچک می‌شود تا سریع باشد) */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  // دیکودرِ خودِ گوشی مستقیم روی عکس
  const det = getDetector();
  let full: ImageBitmap | null = null;
  try { full = await createImageBitmap(file); } catch {}
  if (det && full) {
    try {
      const r = await det.detect(full);
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
    // crop<1: فقط وسطِ عکس (جایی که معمولاً QR است)
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
    // از ارزان به گران: کلِ عکس کوچک، وسطِ عکس، بزرگ‌تر، و در آخر تلاشِ کامل
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

/** امکانِ اسکنِ زنده: دوربینِ زنده فقط روی HTTPS (یا localhost) در دسترس است */
export const canLiveScan = () =>
  typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

/** آیا صفحه داخلِ مرورگرِ درون‌برنامه‌ای (تلگرام، اینستاگرام، …) باز شده؟ */
export function inAppBrowser(): string | null {
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "اینستاگرام";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "فیسبوک";
  if (/Telegram/i.test(ua)) return "تلگرام";
  if (/WhatsApp/i.test(ua)) return "واتساپ";
  if (/; wv\)/.test(ua)) return "یک برنامه";
  return null;
}
/** لینکِ بازکردنِ همین صفحه در Chrome (اندروید) */
export const chromeIntent = () =>
  `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;

/** اسکنِ زنده با دوربین (تمام‌صفحه) */
export function LiveScanner({ onResult, onClose, onError }: { onResult: (text: string) => void; onClose: () => void; onError: (name: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState("در حال درخواستِ اجازهٔ دوربین… اگر پنجرهٔ اجازه آمد «اجازه دادن» را بزنید");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    // اگر دوربین تا ۸ ثانیه جواب نداد (پنجرهٔ اجازه نیامد/گیر کرد) بی‌صدا نمان
    const watchdog = window.setTimeout(() => { if (!stop && !stream) { stop = true; onError("Timeout"); } }, 8000);
    (async () => {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch (e) {
          // اجازه رد شده → همان خطا؛ بقیه (دوربینِ قدیمی/محدودیت) → یک بار با تنظیماتِ ساده
          if ((e as Error)?.name === "NotAllowedError" || (e as Error)?.name === "SecurityError") throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        // فوکوسِ پیوسته (اگر دوربین پشتیبانی کند) برای خواندنِ سریعِ QRِ نزدیک
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
          // بعضی گوشی‌ها اولین play را رد می‌کنند؛ بعد از آماده‌شدنِ تصویر دوباره
          await new Promise((res) => v.addEventListener("loadedmetadata", res, { once: true }));
          await v.play();
        }
        setHint("QR روی میز را داخل کادر بگیرید");
        const det = getDetector();
        if (!det) await loadJsQR(); // قبل از شروعِ حلقه
        let n = 0;
        const tick = async () => {
          if (stop) return;
          if (v.videoWidth) {
            let text: string | null = null;
            if (det) {
              // دیکودرِ خودِ گوشی مستقیم روی ویدیو (سریع)
              try { text = (await det.detect(v))[0]?.rawValue || null; } catch {}
            } else {
              // فقط مربعِ وسط (همان کادرِ اسکن) و کوچک‌شده → چند برابر سریع‌تر
              const side = Math.min(v.videoWidth, v.videoHeight) * 0.8;
              const out = 480;
              canvas.width = out; canvas.height = out;
              ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, out, out);
              // هر چند فریم یک‌بار تلاشِ کامل (QRِ برعکس/کم‌کنتراست)
              text = await decodeQr(ctx.getImageData(0, 0, out, out), ++n % 6 === 0).catch(() => null);
            }
            if (text && !stop) {
              stop = true;
              onResult(text);
              return;
            }
          }
          timer = window.setTimeout(tick, det ? 80 : 60);
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
      {/* کادرِ اسکن */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative size-64 rounded-[2rem] shadow-[0_0_0_9999px_rgba(0,0,0,.55)]">
          {["right-0 top-0 border-r-4 border-t-4 rounded-tr-[2rem]", "left-0 top-0 border-l-4 border-t-4 rounded-tl-[2rem]", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-[2rem]", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-[2rem]"].map((c) => (
            <span key={c} className={`absolute size-12 border-white ${c}`} />
          ))}
          <span className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse rounded bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
        </div>
      </div>
      <p className="absolute inset-x-0 bottom-24 text-center text-sm font-semibold text-white">{hint}</p>
      <button onClick={onClose} aria-label="بستن" className="absolute left-4 top-4 grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
        <X className="size-6" />
      </button>
    </div>
  );
}
