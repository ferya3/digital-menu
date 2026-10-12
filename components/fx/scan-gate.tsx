"use client";

import { useEffect, useState } from "react";
import { QrCode, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CafeInfo } from "@/lib/types";

const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");

/** بدون شمارهٔ میز: «QR میز خود را اسکن کنید» (مثل نسخهٔ قبلی) + فقط دیدنِ منو */
export function ScanGate({ cafe }: { cafe: CafeInfo }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { if (sessionStorage.getItem("cafe_browse")) setOpen(false); } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-background p-5" data-lenis-prevent>
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-16 place-items-center overflow-hidden rounded-[1.4rem] bg-card text-4xl shadow-lg ring-1 ring-border">
          {isImg(cafe.logo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cafe.logo + "?w=160"} alt="" className="size-full object-cover" />
          ) : cafe.logo || "☕"}
        </span>
        <h1 className="text-2xl font-black">{cafe.name}</h1>
        <div className="mx-auto mt-8 grid size-36 place-items-center rounded-[2rem] border-2 border-dashed border-primary/40 bg-primary/5 text-primary">
          <QrCode className="size-20" strokeWidth={1.4} />
        </div>
        <h2 className="mt-6 text-xl font-extrabold">QR میز خود را اسکن کنید</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-7 text-muted-foreground">
          برای سفارش، QR کدِ روی میزتان را با دوربین گوشی اسکن کنید تا منوی همان میز باز شود.
        </p>
        <Button
          variant="outline"
          size="lg"
          className="mt-6 rounded-full px-6"
          onClick={() => { try { sessionStorage.setItem("cafe_browse", "1"); } catch {} setOpen(false); }}
        >
          <Eye className="size-4" /> فقط دیدنِ منو
        </Button>
      </div>
    </div>
  );
}
