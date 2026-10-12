"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Detector = { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> };

/** خواندنِ QR از یک تصویر: اول دیکودرِ خودِ گوشی (BarcodeDetector)، وگرنه jsQR */
export async function decodeQr(img: ImageData): Promise<string | null> {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (BD) {
    try {
      const r = await new BD({ formats: ["qr_code"] }).detect(img);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch {}
  }
  const jsQR = (await import("jsqr")).default;
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data || null;
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

/** تصویرِ عکس‌گرفته‌شده → ImageData (در چند اندازه تا QRِ کوچک/بزرگ هر دو خوانده شوند) */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    for (const max of [1600, 900, 2400]) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const text = await decodeQr(ctx.getImageData(0, 0, c.width, c.height));
      if (text) return text;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** امکانِ اسکنِ زنده: دوربینِ زنده فقط روی HTTPS (یا localhost) در دسترس است */
export const canLiveScan = () =>
  typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

/** اسکنِ زنده با دوربین (تمام‌صفحه) */
export function LiveScanner({ onResult, onClose, onError }: { onResult: (text: string) => void; onClose: () => void; onError: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState("در حال روشن‌کردنِ دوربین…");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let timer = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setHint("QR روی میز را داخل کادر بگیرید");
        const tick = async () => {
          if (stop) return;
          if (v.videoWidth) {
            const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * s);
            canvas.height = Math.round(v.videoHeight * s);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const text = await decodeQr(ctx.getImageData(0, 0, canvas.width, canvas.height)).catch(() => null);
            if (text && !stop) {
              stop = true;
              onResult(text);
              return;
            }
          }
          timer = window.setTimeout(tick, 220);
        };
        tick();
      } catch {
        if (!stop) onError();
      }
    })();
    return () => {
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
