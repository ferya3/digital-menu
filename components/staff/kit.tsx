"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import type { OrderCodeMode } from "@/lib/types";

/** Shared panel context (currency, order code mode, flash messages) */
export interface StaffCtx {
  cafeName: string;
  money: (n: number) => string;
  /** ISO 4217 code, e.g. "USD" */
  currency: string;
  codeMode: OrderCodeMode;
  flash: (m: string) => void;
  /** Print window for invoices/bills */
  print: (q: string) => void;
  /** Full-size receipt image viewer */
  viewImage: (src: string) => void;
  /** Text prompt dialog (e.g. rejection reason); null means cancelled */
  ask: (title: string, hint?: string) => Promise<string | null>;
}
export const Ctx = createContext<StaffCtx | null>(null);
export const useStaff = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("StaffCtx missing");
  return c;
};

export const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

export function Panel({ title, icon, count, action, className, children }: {
  title: string; icon?: React.ReactNode; count?: number | string; action?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          {icon}
          {title}
          {count !== undefined && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">{text}</p>;
}

export function TableBadge({ table }: { table: string }) {
  return <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold text-background">Table {table}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}

/** Category icon: emoji or uploaded image */
export const isImgSrc = (s: string) => /^https?:|^data:|^blob:|^\/uploads\//.test(s || "");
export function CatIcon({ icon, className }: { icon: string; className?: string }) {
  return isImgSrc(icon) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt="" className={cn("size-full rounded-[inherit] object-cover", className)} />
  ) : (
    <>{icon || "🍽️"}</>
  );
}
