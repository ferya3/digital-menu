"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareSheet, nativeShare, type ShareTarget } from "@/components/menu/share-sheet";

export function ProductShare({ target }: { target: ShareTarget }) {
  const [open, setOpen] = useState<ShareTarget | null>(null);
  return (
    <>
      <button
        onClick={async () => { if (!(await nativeShare(target))) setOpen(target); }}
        className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-5 font-bold transition hover:bg-muted"
      >
        <Share2 className="size-5" /> Share
      </button>
      <ShareSheet target={open} onClose={() => setOpen(null)} />
    </>
  );
}
