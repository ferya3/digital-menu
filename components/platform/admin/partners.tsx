"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, ExternalLink, HandCoins, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDate, getPlatformCurrency, money, num, parsePrice } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminDeletePartnerAction, adminPartnersAction, adminPayoutAction, adminSavePartnerAction, type AdminPartner } from "@/app/platform/actions";
import type { Partner } from "@/lib/partners";
import { Box, L, Modal, Toggle, err, smallField, type Flash } from "./shared";

type Draft = Pick<Partner, "code" | "name" | "phone" | "percent" | "scope" | "active" | "note">;
const blank: Draft = { code: "", name: "", phone: "", percent: 20, scope: "first", active: true, note: "" };

/** Partners (referrers): personal link, commission, reports and payouts */
export function Partners({ flash }: { flash: Flash }) {
  const [list, setList] = useState<AdminPartner[] | null>(null);
  const [edit, setEdit] = useState<{ d: Draft; prev?: string } | null>(null);
  const [pay, setPay] = useState<AdminPartner | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => adminPartnersAction().then((r) => setList(unwrap(r))).catch((e) => flash("❌ " + err(e))), [flash]);
  useEffect(() => { load(); }, [load]);
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => flash("📋 Copied"), () => flash(t));

  if (!list) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  const owed = list.reduce((s, p) => s + Math.max(0, p.stats.balance), 0);

  return (
    <div className="space-y-4">
      <Box title={`Partners (${num(list.length)})`} action={<Button size="sm" className="rounded-xl" onClick={() => setEdit({ d: { ...blank } })}><Plus className="size-4" /> New partner</Button>}>
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
          Give print shops, POS resellers, designers and anyone who works with cafés and restaurants a personal link. Anyone who signs up through it (or enters the partner code on the signup form) is credited to that partner, and commission is calculated on their payments.
          Each partner also gets a private report page (no password, secret link) to see their own stats.
          {owed > 0 && <b className="mt-1 block text-foreground">Total unpaid commission: {money(owed)}</b>}
        </p>
        <div className="space-y-2">
          {list.map((p) => (
            <div key={p.code} className="rounded-2xl border border-border bg-background">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <button type="button" onClick={() => setOpen(open === p.code ? null : p.code)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open === p.code && "rotate-180")} />
                  <div className="min-w-0">
                    <b className="block truncate text-sm">{p.name} {!p.active && <span className="text-xs font-normal text-muted-foreground">(inactive)</span>}</b>
                    <span className="text-xs text-muted-foreground"><span>{p.code}</span> · {num(p.percent)}% {p.scope === "first" ? "of the first payment" : "of all payments"}</span>
                  </div>
                </button>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>Signups: <b>{num(p.stats.signups)}</b></span>
                  <span>Paying: <b>{num(p.stats.paying)}</b></span>
                  <span>Commission: <b>{money(p.stats.commission)}</b></span>
                  <span className={p.stats.balance > 0 ? "text-primary" : ""}>Balance: <b>{money(p.stats.balance)}</b></span>
                </div>
                <div className="flex gap-1">
                  <button type="button" title="Copy partner link" aria-label="Copy partner link" onClick={() => copy(p.link)} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Copy className="size-4" /></button>
                  <a href={p.dashboard} target="_blank" rel="noopener" title="Partner report page" aria-label="Partner report page" className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="size-4" /></a>
                  <button type="button" title="Record payout" aria-label="Record payout" onClick={() => setPay(p)} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><HandCoins className="size-4" /></button>
                  <button type="button" title="Edit" aria-label="Edit" onClick={() => setEdit({ d: { code: p.code, name: p.name, phone: p.phone, percent: p.percent, scope: p.scope, active: p.active, note: p.note }, prev: p.code })} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="size-4" /></button>
                  <button type="button" title="Delete" aria-label="Delete" onClick={async () => {
                    if (!confirm(`Delete partner “${p.name}”? (Referred venues are not affected.)`)) return;
                    try { unwrap(await adminDeletePartnerAction(p.code)); load(); } catch (e) { flash("❌ " + err(e)); }
                  }} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
                </div>
              </div>
              {open === p.code && (
                <div className="space-y-3 border-t border-border p-3 text-xs">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>Partner link: <button type="button" onClick={() => copy(p.link)} className="font-semibold text-primary">{p.link}</button></div>
                    <div>Report page: <button type="button" onClick={() => copy(p.dashboard)} className="font-semibold text-primary">Copy link (to send to the partner)</button></div>
                    {p.phone && <div>Phone: <span>{num(p.phone)}</span></div>}
                    {p.note && <div>Note: {p.note}</div>}
                  </div>
                  <table className="w-full">
                    <thead className="text-muted-foreground"><tr><th className="py-1 text-start">Venue</th><th className="text-start">Signed up</th><th className="text-start">Status</th><th className="text-start">Paid</th><th className="text-start">Commission</th></tr></thead>
                    <tbody>
                      {p.stats.referrals.map((r) => <tr key={r.slug} className="border-t border-border"><td className="py-1.5">{r.name} <span className="text-muted-foreground">({r.slug})</span></td><td>{fmtDate(r.createdAt)}</td><td>{r.state}</td><td>{money(r.paid)}</td><td>{money(r.commission)}</td></tr>)}
                      {!p.stats.referrals.length && <tr><td colSpan={5} className="py-3 text-center text-muted-foreground">No signups yet.</td></tr>}
                    </tbody>
                  </table>
                  {p.payouts.length > 0 && (
                    <div>
                      <b>Payouts</b>
                      <ul className="mt-1 space-y-1">{p.payouts.map((x, i) => <li key={i} className="flex justify-between"><span>{fmtDate(x.at)}{x.note && ` · ${x.note}`}</span><b>{money(x.amount)}</b></li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {!list.length && <p className="py-8 text-center text-sm text-muted-foreground">No partners yet.</p>}
        </div>
      </Box>

      {edit && <EditModal init={edit.d} prev={edit.prev} flash={flash} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {pay && <PayoutModal p={pay} flash={flash} onClose={() => setPay(null)} onSaved={() => { setPay(null); load(); }} />}
    </div>
  );
}

function EditModal({ init, prev, flash, onClose, onSaved }: { init: Draft; prev?: string; flash: Flash; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(init);
  const [busy, setBusy] = useState(false);
  const put = (x: Partial<Draft>) => setD((v) => ({ ...v, ...x }));
  async function save() {
    setBusy(true);
    try { unwrap(await adminSavePartnerAction(d, prev)); flash("✅ Saved"); onSaved(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={prev ? "Edit partner" : "New partner"} onClose={onClose}>
      <div className="space-y-3">
        <L t="Name (person or company)"><input value={d.name} onChange={(e) => put({ name: e.target.value })} className={smallField} placeholder="Acme Print Shop" /></L>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="Partner code (used in the link)" hint="Lowercase letters, numbers, hyphens"><input value={d.code} onChange={(e) => put({ code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className={smallField} placeholder="acme-print" maxLength={20} /></L>
          <L t="Phone"><input type="tel" value={d.phone} onChange={(e) => put({ phone: e.target.value })} className={smallField} placeholder="+1 555 123 4567" /></L>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="Commission (%)"><input type="number" min={0} max={100} value={d.percent} onChange={(e) => put({ percent: Number(e.target.value) })} className={smallField} /></L>
          <L t="Applies to">
            <select value={d.scope} onChange={(e) => put({ scope: e.target.value as Draft["scope"] })} className={smallField}>
              <option value="first">Only each venue’s first payment</option>
              <option value="all">All payments (including renewals)</option>
            </select>
          </L>
        </div>
        <L t="Note (only visible to you)"><input value={d.note} onChange={(e) => put({ note: e.target.value })} className={smallField} /></L>
        <Toggle checked={d.active} onChange={(v) => put({ active: v })} label="Active (new signups are credited to this partner)" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="rounded-xl" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />} Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function PayoutModal({ p, flash, onClose, onSaved }: { p: AdminPartner; flash: Flash; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(Math.max(0, p.stats.balance)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { unwrap(await adminPayoutAction(p.code, parsePrice(amount), note)); flash("✅ Payout recorded"); onSaved(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Record payout to ${p.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Balance: <b className="text-foreground">{money(p.stats.balance)}</b> — record the amount you paid the partner.</p>
        <L t={`Amount (${getPlatformCurrency()})`}><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={smallField} /></L>
        <L t="Note (e.g. transfer reference)"><input value={note} onChange={(e) => setNote(e.target.value)} className={smallField} /></L>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="rounded-xl" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />} Record</Button>
        </div>
      </div>
    </Modal>
  );
}
