"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Print/close buttons (hidden when printing) + auto-print on open */
export function PrintBar({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(t);
  }, [auto]);
  return (
    <div className="mb-4 flex justify-center gap-2 print:hidden">
      <Button className="rounded-xl" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
      <Button variant="outline" className="rounded-xl bg-white" onClick={() => window.close()}><X className="size-4" /> Close</Button>
    </div>
  );
}
