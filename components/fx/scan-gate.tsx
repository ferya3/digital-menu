"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Eye, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveScanner, canLiveScan, decodeQrFromFile, tableFromQr } from "@/components/fx/qr-scanner";
import type { CafeInfo } from "@/lib/types";

const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");

/** بدون شمارهٔ میز: «QR میز خود را اسکن کنید» + اسکن با دوربین + فقط دیدنِ منو */
export function ScanGate({ cafe }: { cafe: CafeInfo }) {
  const [open, setOpen] = useState(true);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { if (sessionStorage.getItem("cafe_browse")) setOpen(false); } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  const go = useCallback((text: string) => {
    const t = tableFromQr(text);
    if (!t) { setLive(false); setErr("این QR مربوط به میزهای کافه نیست؛ QRِ روی میز را اسکن کنید."); return; }
    try { sessionStorage.removeItem("cafe_browse"); } catch {}
    window.location.href = `/?table=${encodeURIComponent(t)}`;
  }, []);
  const liveFailed = useCallback(() => { setLive(false); fileRef.current?.click(); }, []);
  const closeLive = useCallback(() => setLive(false), []);

  function scan() {
    setErr("");
    // دوربینِ زنده فقط روی HTTPS؛ روی HTTP دوربینِ گوشی برای گرفتنِ عکس از QR باز می‌شود
    if (canLiveScan()) setLive(true);
    else fileRef.current?.click();
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
          دکمهٔ زیر را بزنید و دوربین را روی QR کدِ روی میزتان بگیرید تا منوی همان میز باز شود.
        </p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(f); }} />
        <Button size="lg" className="mt-6 h-12 w-full max-w-xs rounded-full text-base" onClick={scan} disabled={busy}>
          {busy ? <><Loader2 className="animate-spin" /> در حال خواندنِ QR…</> : <><Camera className="size-5" /> اسکن QR با دوربین</>}
        </Button>
        {err && <p className="mx-auto mt-3 max-w-xs rounded-xl bg-primary/10 p-2.5 text-sm text-primary">{err}</p>}
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
