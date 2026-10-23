"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, ExternalLink, HandCoins, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDate, money, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminDeletePartnerAction, adminPartnersAction, adminPayoutAction, adminSavePartnerAction, type AdminPartner } from "@/app/platform/actions";
import type { Partner } from "@/lib/partners";
import { Box, L, Modal, Toggle, err, smallField, type Flash } from "./shared";

type Draft = Pick<Partner, "code" | "name" | "phone" | "percent" | "scope" | "active" | "note">;
const blank: Draft = { code: "", name: "", phone: "", percent: 20, scope: "first", active: true, note: "" };

/** همکاران (معرف‌ها): لینکِ اختصاصی، پورسانت، گزارش و تسویه */
export function Partners({ flash }: { flash: Flash }) {
  const [list, setList] = useState<AdminPartner[] | null>(null);
  const [edit, setEdit] = useState<{ d: Draft; prev?: string } | null>(null);
  const [pay, setPay] = useState<AdminPartner | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => adminPartnersAction().then((r) => setList(unwrap(r))).catch((e) => flash("❌ " + err(e))), [flash]);
  useEffect(() => { load(); }, [load]);
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => flash("📋 کپی شد"), () => flash(t));

  if (!list) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  const owed = list.reduce((s, p) => s + Math.max(0, p.stats.balance), 0);

  return (
    <div className="space-y-4">
      <Box title={`همکاران (${toFa(list.length)})`} action={<Button size="sm" className="rounded-xl" onClick={() => setEdit({ d: { ...blank } })}><Plus className="size-4" /> همکارِ جدید</Button>}>
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
          به چاپخانه‌ها، فروشنده‌های کارت‌خوان، طراح‌ها و هر کسی که با کافه و رستوران‌ها کار می‌کند یک لینکِ اختصاصی بدهید. هر کس با آن لینک (یا با واردکردنِ کدِ همکار در فرمِ ثبت‌نام) عضو شود، به نامِ آن همکار ثبت می‌شود و از پرداخت‌هایش پورسانت حساب می‌شود.
          هر همکار یک صفحهٔ گزارشِ اختصاصی هم دارد (بدونِ رمز، با لینکِ مخفی) تا آمارِ خودش را ببیند.
          {owed > 0 && <b className="mt-1 block text-foreground">جمعِ پورسانتِ پرداخت‌نشده: {money(owed)}</b>}
        </p>
        <div className="space-y-2">
          {list.map((p) => (
            <div key={p.code} className="rounded-2xl border border-border bg-background">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <button type="button" onClick={() => setOpen(open === p.code ? null : p.code)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open === p.code && "rotate-180")} />
                  <div className="min-w-0">
                    <b className="block truncate text-sm">{p.name} {!p.active && <span className="text-xs font-normal text-muted-foreground">(غیرفعال)</span>}</b>
                    <span className="text-xs text-muted-foreground"><span dir="ltr">{p.code}</span> · {toFa(p.percent)}٪ {p.scope === "first" ? "از اولین پرداخت" : "از همهٔ پرداخت‌ها"}</span>
                  </div>
                </button>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>ثبت‌نام: <b>{toFa(p.stats.signups)}</b></span>
                  <span>خریدار: <b>{toFa(p.stats.paying)}</b></span>
                  <span>پورسانت: <b>{money(p.stats.commission)}</b></span>
                  <span className={p.stats.balance > 0 ? "text-primary" : ""}>مانده: <b>{money(p.stats.balance)}</b></span>
                </div>
                <div className="flex gap-1">
                  <button type="button" title="کپیِ لینکِ همکار" aria-label="کپیِ لینکِ همکار" onClick={() => copy(p.link)} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Copy className="size-4" /></button>
                  <a href={p.dashboard} target="_blank" rel="noopener" title="صفحهٔ گزارشِ همکار" aria-label="صفحهٔ گزارشِ همکار" className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="size-4" /></a>
                  <button type="button" title="ثبتِ تسویه" aria-label="ثبتِ تسویه" onClick={() => setPay(p)} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><HandCoins className="size-4" /></button>
                  <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setEdit({ d: { code: p.code, name: p.name, phone: p.phone, percent: p.percent, scope: p.scope, active: p.active, note: p.note }, prev: p.code })} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="size-4" /></button>
                  <button type="button" title="حذف" aria-label="حذف" onClick={async () => {
                    if (!confirm(`همکارِ «${p.name}» حذف شود؟ (مجموعه‌های معرفی‌شده سرِ جایشان می‌مانند)`)) return;
                    try { unwrap(await adminDeletePartnerAction(p.code)); load(); } catch (e) { flash("❌ " + err(e)); }
                  }} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
                </div>
              </div>
              {open === p.code && (
                <div className="space-y-3 border-t border-border p-3 text-xs">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>لینکِ همکار: <button type="button" onClick={() => copy(p.link)} className="font-semibold text-primary" dir="ltr">{p.link}</button></div>
                    <div>صفحهٔ گزارش: <button type="button" onClick={() => copy(p.dashboard)} className="font-semibold text-primary">کپیِ لینک (برای ارسال به همکار)</button></div>
                    {p.phone && <div>تلفن: <span dir="ltr">{toFa(p.phone)}</span></div>}
                    {p.note && <div>یادداشت: {p.note}</div>}
                  </div>
                  <table className="w-full">
                    <thead className="text-muted-foreground"><tr><th className="py-1 text-start">مجموعه</th><th className="text-start">ثبت‌نام</th><th className="text-start">وضعیت</th><th className="text-start">پرداخت‌شده</th><th className="text-start">پورسانت</th></tr></thead>
                    <tbody>
                      {p.stats.referrals.map((r) => <tr key={r.slug} className="border-t border-border"><td className="py-1.5">{r.name} <span className="text-muted-foreground" dir="ltr">({r.slug})</span></td><td>{faDate(r.createdAt)}</td><td>{r.state}</td><td>{money(r.paid)}</td><td>{money(r.commission)}</td></tr>)}
                      {!p.stats.referrals.length && <tr><td colSpan={5} className="py-3 text-center text-muted-foreground">هنوز ثبت‌نامی نیامده.</td></tr>}
                    </tbody>
                  </table>
                  {p.payouts.length > 0 && (
                    <div>
                      <b>تسویه‌ها</b>
                      <ul className="mt-1 space-y-1">{p.payouts.map((x, i) => <li key={i} className="flex justify-between"><span>{faDate(x.at)}{x.note && ` · ${x.note}`}</span><b>{money(x.amount)}</b></li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {!list.length && <p className="py-8 text-center text-sm text-muted-foreground">هنوز همکاری تعریف نشده.</p>}
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
    try { unwrap(await adminSavePartnerAction(d, prev)); flash("✅ ذخیره شد"); onSaved(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={prev ? "ویرایشِ همکار" : "همکارِ جدید"} onClose={onClose}>
      <div className="space-y-3">
        <L t="نام (شخص یا مجموعه)"><input value={d.name} onChange={(e) => put({ name: e.target.value })} className={smallField} placeholder="چاپخانهٔ پارس" /></L>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="کدِ همکار (در لینک)" hint="انگلیسیِ کوچک، عدد، خط‌تیره"><input value={d.code} onChange={(e) => put({ code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} dir="ltr" className={smallField} placeholder="chap-pars" maxLength={20} /></L>
          <L t="تلفن"><input value={d.phone} onChange={(e) => put({ phone: e.target.value })} dir="ltr" className={smallField} placeholder="0912…" /></L>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="درصدِ پورسانت"><input type="number" min={0} max={100} value={d.percent} onChange={(e) => put({ percent: Number(e.target.value) })} dir="ltr" className={smallField} /></L>
          <L t="از کدام پرداخت‌ها">
            <select value={d.scope} onChange={(e) => put({ scope: e.target.value as Draft["scope"] })} className={smallField}>
              <option value="first">فقط اولین پرداختِ هر مجموعه</option>
              <option value="all">همهٔ پرداخت‌ها (تمدیدها هم)</option>
            </select>
          </L>
        </div>
        <L t="یادداشت (فقط برای شما)"><input value={d.note} onChange={(e) => put({ note: e.target.value })} className={smallField} /></L>
        <Toggle checked={d.active} onChange={(v) => put({ active: v })} label="فعال (ثبت‌نام‌های تازه به نامِ این همکار ثبت شوند)" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>انصراف</Button>
          <Button className="rounded-xl" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />} ذخیره</Button>
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
    try { unwrap(await adminPayoutAction(p.code, Number(amount.replace(/[^\d]/g, "")), note)); flash("✅ تسویه ثبت شد"); onSaved(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`ثبتِ تسویه با ${p.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">مانده: <b className="text-foreground">{money(p.stats.balance)}</b> — مبلغی را که به همکار پرداخت کرده‌اید ثبت کنید.</p>
        <L t="مبلغ (تومان)"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" dir="ltr" className={smallField} /></L>
        <L t="توضیح (مثلاً شمارهٔ پیگیری)"><input value={note} onChange={(e) => setNote(e.target.value)} className={smallField} /></L>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>انصراف</Button>
          <Button className="rounded-xl" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />} ثبت</Button>
        </div>
      </div>
    </Modal>
  );
}
