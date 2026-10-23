"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const err = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
export type Flash = (t: string) => void;

export const fieldCls =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";
export const smallField = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

export const STATE: Record<string, { label: string; cls: string }> = {
  trial: { label: "Trial", cls: "bg-blue-600/10 text-blue-700 dark:text-blue-400" },
  active: { label: "Active", cls: "bg-green-600/10 text-green-700 dark:text-green-400" },
  expired: { label: "Expired", cls: "bg-primary/10 text-primary" },
  suspended: { label: "Suspended", cls: "bg-muted text-muted-foreground" },
};

// Defined outside components so they are not recreated on every keystroke (inputs keep focus)
export function Box({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-border bg-card p-4", className)}>
      {/* On phones, actions wrap below the title (so the title is not squeezed) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="min-w-0 font-extrabold">{title}</h2>{action}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
export function L({ t, children, hint }: { t: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">{t}</span>{children}{hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={cn("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl", wide ? "max-w-2xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-muted"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "right-0.5" : "right-[1.375rem]")} />
      </button>
      {label}
    </label>
  );
}

/** CSV export (with a UTF-8 BOM so Excel opens it correctly) */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = "﻿" + rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
