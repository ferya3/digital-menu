"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDate, getPlatformCurrency, money, num, parsePrice } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminCouponsAction, adminDeleteCouponAction, adminSaveCouponAction } from "@/app/platform/actions";
import type { Coupon } from "@/lib/platform-admin";
import type { Plan } from "@/lib/platform";
import { Box, L, Modal, Toggle, err, smallField, type Flash } from "./shared";

const blank = (): Coupon => ({ code: "", kind: "percent", value: 20, maxUses: 0, used: 0, expiresAt: "", plans: [], active: true, note: "", createdAt: "" });

/** Subscription coupon codes (e.g. a seasonal promotion) */
export function Coupons({ flash, plans }: { flash: Flash; plans: Plan[] }) {
  const [list, setList] = useState<Coupon[] | null>(null);
  const [edit, setEdit] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => adminCouponsAction().then((r) => setList(unwrap(r))).catch((e) => flash("❌ " + err(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!edit) return;
    setBusy(true);
    try { unwrap(await adminSaveCouponAction(edit)); flash("✅ Coupon saved"); setEdit(null); load(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try { unwrap(await adminDeleteCouponAction(c.code)); load(); } catch (e) { flash("❌ " + err(e)); }
  }

  return (
    <div className="space-y-4">
      <Box title="Subscription coupons" action={<Button size="sm" className="rounded-xl" onClick={() => setEdit(blank())}><Plus className="size-4" /> New coupon</Button>}>
        <p className="text-xs text-muted-foreground">Venues enter the code when renewing under Subscription; a 100% coupon activates the subscription without payment. Uses are counted only after a successful payment.</p>
        {!list ? <Loader2 className="mx-auto animate-spin text-muted-foreground" /> : list.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No coupons yet</p> : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Code", "Discount", "Used", "Expires", "Plans", "Status", ""].map((h, i) => <th key={i} className="p-2.5 text-start font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {list.map((c) => {
                  const expired = c.expiresAt && +new Date(c.expiresAt) < Date.now();
                  const full = c.maxUses && c.used >= c.maxUses;
                  return (
                    <tr key={c.code} className="border-t border-border">
                      <td className="p-2.5 font-mono font-bold">{c.code}</td>
                      <td className="p-2.5">{c.kind === "percent" ? `${num(c.value)}%` : money(c.value)}</td>
                      <td className="p-2.5">{num(c.used)}{c.maxUses ? ` of ${num(c.maxUses)}` : ""}</td>
                      <td className="p-2.5 text-muted-foreground">{c.expiresAt ? fmtDate(c.expiresAt) : "—"}</td>
                      <td className="p-2.5 text-xs text-muted-foreground">{c.plans.length ? c.plans.map((p) => plans.find((x) => x.id === p)?.title || p).join(", ") : "All"}</td>
                      <td className="p-2.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", c.active && !expired && !full ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground")}>{!c.active ? "Inactive" : expired ? "Expired" : full ? "Used up" : "Active"}</span></td>
                      <td className="p-2.5">
                        <div className="flex gap-1">
                          <button aria-label="Edit" onClick={() => setEdit({ ...c, expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "" })} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="size-4" /></button>
                          <button aria-label="Delete" onClick={() => remove(c)} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Box>

      {edit && (
        <Modal title={edit.createdAt ? `Edit ${edit.code}` : "New coupon"} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <L t="Code (letters and numbers)"><input value={edit.code} disabled={!!edit.createdAt} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="SPRING26" className={smallField} /></L>
            <div className="grid grid-cols-2 gap-2">
              <L t="Type"><select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Coupon["kind"] })} className={smallField}><option value="percent">Percentage</option><option value="amount">Fixed amount ({getPlatformCurrency()})</option></select></L>
              <L t={edit.kind === "percent" ? "Percent (%)" : `Amount (${getPlatformCurrency()})`}><input type="number" inputMode="decimal" min={0} max={edit.kind === "percent" ? 100 : undefined} step={edit.kind === "percent" ? 1 : "0.01"} value={edit.value} onChange={(e) => setEdit({ ...edit, value: edit.kind === "percent" ? Number(e.target.value) : parsePrice(e.target.value) })} className={smallField} /></L>
              <L t="Max uses" hint="0 = unlimited"><input type="number" min={0} value={edit.maxUses} onChange={(e) => setEdit({ ...edit, maxUses: Number(e.target.value) })} className={smallField} /></L>
              <L t="Expiry date (optional)"><input type="date" value={edit.expiresAt} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value })} className={smallField} /></L>
            </div>
            <L t="Only for these plans" hint="None selected = all plans">
              <div className="flex flex-wrap gap-2">
                {plans.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
                    <input type="checkbox" className="accent-primary" checked={edit.plans.includes(p.id)} onChange={(e) => setEdit({ ...edit, plans: e.target.checked ? [...edit.plans, p.id] : edit.plans.filter((x) => x !== p.id) })} />
                    {p.title}
                  </label>
                ))}
              </div>
            </L>
            <L t="Note (internal)"><input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} className={smallField} /></L>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" />
            <Button className="h-11 w-full rounded-2xl" disabled={busy || !edit.code} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : "Save"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
