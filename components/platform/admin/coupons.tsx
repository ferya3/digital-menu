"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDate, money, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminCouponsAction, adminDeleteCouponAction, adminSaveCouponAction } from "@/app/platform/actions";
import type { Coupon } from "@/lib/platform-admin";
import type { Plan } from "@/lib/platform";
import { Box, L, Modal, Toggle, err, smallField, type Flash } from "./shared";

const blank = (): Coupon => ({ code: "", kind: "percent", value: 20, maxUses: 0, used: 0, expiresAt: "", plans: [], active: true, note: "", createdAt: "" });

/** کدهای تخفیفِ اشتراک (مثلاً جشنوارهٔ نوروزی) */
export function Coupons({ flash, plans }: { flash: Flash; plans: Plan[] }) {
  const [list, setList] = useState<Coupon[] | null>(null);
  const [edit, setEdit] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => adminCouponsAction().then((r) => setList(unwrap(r))).catch((e) => flash("❌ " + err(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!edit) return;
    setBusy(true);
    try { unwrap(await adminSaveCouponAction(edit)); flash("✅ کد ذخیره شد"); setEdit(null); load(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  async function remove(c: Coupon) {
    if (!confirm(`کدِ ${c.code} حذف شود؟`)) return;
    try { unwrap(await adminDeleteCouponAction(c.code)); load(); } catch (e) { flash("❌ " + err(e)); }
  }

  return (
    <div className="space-y-4">
      <Box title="کدهای تخفیفِ اشتراک" action={<Button size="sm" className="rounded-xl" onClick={() => setEdit(blank())}><Plus className="size-4" /> کدِ جدید</Button>}>
        <p className="text-xs text-muted-foreground">مجموعه‌ها هنگامِ تمدید در بخشِ «اشتراک» کد را وارد می‌کنند؛ کدِ ۱۰۰٪ اشتراک را بدونِ پرداخت فعال می‌کند. شمارشِ استفاده فقط بعد از پرداختِ موفق.</p>
        {!list ? <Loader2 className="mx-auto animate-spin text-muted-foreground" /> : list.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">هنوز کدی ساخته نشده</p> : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["کد", "تخفیف", "استفاده", "انقضا", "طرح‌ها", "وضعیت", ""].map((h) => <th key={h} className="p-2.5 text-right font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {list.map((c) => {
                  const expired = c.expiresAt && +new Date(c.expiresAt) < Date.now();
                  const full = c.maxUses && c.used >= c.maxUses;
                  return (
                    <tr key={c.code} className="border-t border-border">
                      <td className="p-2.5 font-mono font-bold" dir="ltr">{c.code}</td>
                      <td className="p-2.5">{c.kind === "percent" ? `${toFa(c.value)}٪` : money(c.value)}</td>
                      <td className="p-2.5">{toFa(c.used)}{c.maxUses ? ` از ${toFa(c.maxUses)}` : ""}</td>
                      <td className="p-2.5 text-muted-foreground">{c.expiresAt ? faDate(c.expiresAt) : "—"}</td>
                      <td className="p-2.5 text-xs text-muted-foreground">{c.plans.length ? c.plans.map((p) => plans.find((x) => x.id === p)?.title || p).join("، ") : "همه"}</td>
                      <td className="p-2.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", c.active && !expired && !full ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground")}>{!c.active ? "غیرفعال" : expired ? "منقضی" : full ? "تمام‌شده" : "فعال"}</span></td>
                      <td className="p-2.5">
                        <div className="flex gap-1">
                          <button aria-label="ویرایش" onClick={() => setEdit({ ...c, expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "" })} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="size-4" /></button>
                          <button aria-label="حذف" onClick={() => remove(c)} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
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
        <Modal title={edit.createdAt ? `ویرایشِ ${edit.code}` : "کدِ تخفیفِ جدید"} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <L t="کد (حروفِ انگلیسی و عدد)"><input value={edit.code} disabled={!!edit.createdAt} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} dir="ltr" placeholder="NOROOZ1405" className={smallField} /></L>
            <div className="grid grid-cols-2 gap-2">
              <L t="نوع"><select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Coupon["kind"] })} className={smallField}><option value="percent">درصد</option><option value="amount">مبلغ (تومان)</option></select></L>
              <L t={edit.kind === "percent" ? "درصد" : "مبلغ (تومان)"}><input type="number" value={edit.value} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} className={smallField} /></L>
              <L t="حداکثر دفعاتِ استفاده" hint="۰ = نامحدود"><input type="number" min={0} value={edit.maxUses} onChange={(e) => setEdit({ ...edit, maxUses: Number(e.target.value) })} className={smallField} /></L>
              <L t="تاریخِ انقضا (اختیاری)"><input type="date" value={edit.expiresAt} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value })} className={smallField} /></L>
            </div>
            <L t="فقط برای این طرح‌ها" hint="هیچ‌کدام = همهٔ طرح‌ها">
              <div className="flex flex-wrap gap-2">
                {plans.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
                    <input type="checkbox" className="accent-primary" checked={edit.plans.includes(p.id)} onChange={(e) => setEdit({ ...edit, plans: e.target.checked ? [...edit.plans, p.id] : edit.plans.filter((x) => x !== p.id) })} />
                    {p.title}
                  </label>
                ))}
              </div>
            </L>
            <L t="یادداشت (داخلی)"><input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} className={smallField} /></L>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="فعال" />
            <Button className="h-11 w-full rounded-2xl" disabled={busy || !edit.code} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : "ذخیره"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
