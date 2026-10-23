"use client";

import { useState } from "react";
import { Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, num } from "@/lib/utils";
import { Panel, inputCls } from "@/components/staff/kit";

export function QrSection() {
  const [count, setCount] = useState(10);
  const [shown, setShown] = useState(10);
  const n = Math.min(100, Math.max(1, shown));
  return (
    <div>
      <Panel title="Table QR codes" icon={<QrCode className="size-5 text-primary" />} className="mb-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Number of tables:</span>
          <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className={cn(inputCls, "w-24")} />
          <Button className="rounded-xl" onClick={() => setShown(count)}>Generate codes</Button>
          <Button variant="outline" className="rounded-xl" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <span className="text-xs text-muted-foreground">Print each code and place it on its table.</span>
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {Array.from({ length: n }, (_, i) => i + 1).map((t) => (
          <div key={t} className="flex break-inside-avoid flex-col items-center gap-1.5 rounded-2xl border border-border bg-white p-4 text-center text-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/qr?table=${t}`} alt={`QR code for table ${t}`} loading="lazy" className="size-40" />
            <h3 className="text-lg font-extrabold">Table {num(t)}</h3>
            <p className="text-xs text-neutral-500">Scan to see the menu and order</p>
          </div>
        ))}
      </div>
    </div>
  );
}
