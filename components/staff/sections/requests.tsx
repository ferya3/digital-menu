"use client";

import { BellRing, Check, CreditCard, Printer, ReceiptText, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDateTime, num } from "@/lib/utils";
import type { StaffRequest } from "@/lib/queries";
import { staffDoneRequestAction, staffSettleTableAction } from "@/app/staff/actions";
import { Empty, Panel, TableBadge, useStaff } from "@/components/staff/kit";

export function RequestsSection({ requests, onChange }: { requests: StaffRequest[]; onChange: (fn: (l: StaffRequest[]) => StaffRequest[]) => void }) {
  const { money, print, flash } = useStaff();
  const pending = requests.filter((r) => r.status === "pending").length;
  const sorted = [...requests].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));
  async function settle(r: StaffRequest) {
    if (!confirm(`Was Table ${num(r.table)} paid with the card reader?`)) return;
    try {
      await staffSettleTableAction(r.table);
      onChange((l) => l.map((x) => (x.id === r.id ? { ...x, status: "done" } : x)));
      flash(`Payment for Table ${num(r.table)} recorded ✅`);
    } catch (e) { flash(e instanceof Error ? e.message : "Error"); }
  }
  async function done(r: StaffRequest) {
    await staffDoneRequestAction(r.id).catch(() => {});
    onChange((l) => l.map((x) => (x.id === r.id ? { ...x, status: "done" } : x)));
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Panel title="Waiter & bill requests" icon={<BellRing className="size-5 text-primary" />} count={num(pending)}>
        {sorted.length === 0 ? <Empty text="No requests" /> : (
          <div className="space-y-2.5">
            {sorted.map((r) => {
              const invoice = r.type === "invoice";
              const pos = r.type === "pos";
              const isDone = r.status === "done";
              return (
                <article key={r.id} className={cn("rounded-2xl border border-border bg-background p-3.5", isDone && "opacity-55")}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <TableBadge table={num(r.table)} />
                    <span className="text-[11px] text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", pos ? "bg-blue-600/10 text-blue-700 dark:text-blue-400" : invoice ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
                      {pos ? <CreditCard className="size-3.5" /> : invoice ? <ReceiptText className="size-3.5" /> : <BellRing className="size-3.5" />}
                      {pos ? "Card reader" : invoice ? "Bill" : "Waiter"}
                    </span>
                    {pos ? (
                      <span>
                        Card reader at the table — print the bill
                        {r.amount > 0 && <> · <b className="text-primary">{money(r.amount)}</b></>}
                      </span>
                    ) : invoice ? (
                      <span>
                        Bill requested
                        {r.amount > 0 && <> · <b className="text-primary">{money(r.amount)}</b>{r.orderCount > 1 && <span className="text-muted-foreground"> ({num(r.orderCount)} orders)</span>}</>}
                      </span>
                    ) : <span>Waiter called</span>}
                  </div>
                  {r.note && (
                    <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[15px] font-bold text-foreground">
                      <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-600" />{r.note}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(invoice || pos) && <Button size="sm" variant={pos && !isDone ? "default" : "outline"} className="h-8 rounded-xl" onClick={() => print("table=" + encodeURIComponent(r.table))}><Printer className="size-3.5" /> Print bill</Button>}
                    {pos && !isDone && <Button size="sm" className="h-8 rounded-xl bg-green-600 text-white hover:bg-green-600/90" onClick={() => settle(r)}><CreditCard className="size-3.5" /> Paid (card reader)</Button>}
                    {isDone ? (
                      <span className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400"><Check className="size-4" /> Done</span>
                    ) : (
                      <Button size="sm" className="h-8 rounded-xl" onClick={() => done(r)}><Check className="size-3.5" /> Mark done</Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
