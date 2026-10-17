"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, CreditCard, Crown, Loader2, Receipt, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDate, faDateTime, money, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import { staffBillingAction, staffBillingPayAction, staffBillingReceiptAction, type BillingInfo } from "@/app/staff/billing-actions";
import { Empty, Panel, inputCls, useStaff } from "@/components/staff/kit";

const STATE: Record<string, { label: string; cls: string }> = {
  trial: { label: "دورهٔ آزمایشی", cls: "bg-blue-600/10 text-blue-700 dark:text-blue-400" },
  active: { label: "فعال", cls: "bg-green-600/10 text-green-700 dark:text-green-400" },
  expired: { label: "منقضی شده", cls: "bg-primary/10 text-primary" },
  suspended: { label: "تعلیق شده", cls: "bg-muted text-muted-foreground" },
};
const PAY_STATUS: Record<string, string> = { pending: "در انتظار بررسی", paid: "پرداخت‌شده ✓", failed: "ناموفق", rejected: "رد شد" };
const METHOD: Record<string, string> = { zarinpal: "آنلاین", card: "کارت‌به‌کارت", manual: "دستی (مدیر)" };

/** اشتراکِ مجموعه: وضعیت، تمدیدِ آنلاین (زرین‌پال) یا کارت‌به‌کارت با فیش */
export function BillingSection() {
  const { flash } = useStaff();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    staffBillingAction().then((r) => {
      const i = unwrap(r);
      setInfo(i);
      setPlan((p) => p || i.plans.find((x) => x.popular)?.id || i.plans[0]?.id || "");
    }).catch((e) => flash("❌ " + (e instanceof Error ? e.message : "خطا")));
  }, [flash]);
  useEffect(load, [load]);

  if (!info) return <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  const st = STATE[info.state] || STATE.active;
  const chosen = info.plans.find((p) => p.id === plan);
  const pending = info.payments.some((p) => p.status === "pending" && p.method === "card");

  async function payOnline() {
    setBusy(true);
    try {
      const { url } = unwrap(await staffBillingPayAction(plan));
      window.location.href = url;
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا")); setBusy(false); }
  }
  async function sendReceipt() {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file, 1600, 0.85);
      unwrap(await staffBillingReceiptAction(plan, imageForm(blob, { note })));
      flash("✅ فیش ارسال شد؛ بعد از تأیید، اشتراک خودکار تمدید می‌شود");
      setFile(null); setNote("");
      load();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا")); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Panel title="وضعیتِ اشتراک" icon={<Crown className="size-5 text-primary" />}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className={cn("rounded-full px-3 py-1 text-sm font-bold", st.cls)}>{st.label}</span>
          <div>
            <div className="text-xs text-muted-foreground">اعتبار تا</div>
            <b>{info.expiresAt.startsWith("2099") ? "نامحدود" : faDate(info.expiresAt)}</b>
          </div>
          {!info.expiresAt.startsWith("2099") && (
            <div>
              <div className="text-xs text-muted-foreground">باقی‌مانده</div>
              <b className={cn(info.daysLeft <= 7 && "text-primary")}>{info.daysLeft > 0 ? `${toFa(info.daysLeft)} روز` : "تمام شده"}</b>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">آدرس منو</div>
            <b dir="ltr">{info.slug}</b>
          </div>
        </div>
        {!info.active && (
          <p className="mt-3 rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">
            {info.state === "suspended" ? "این مجموعه توسط پشتیبانی تعلیق شده است." : "اشتراک تمام شده و منوی مشتری‌ها غیرفعال است."} با تمدید، همه‌چیز (منو، سفارش‌ها، تنظیمات) دوباره فعال می‌شود.
          </p>
        )}
      </Panel>

      {info.state !== "suspended" && !info.expiresAt.startsWith("2099") && (
        <Panel title="تمدید اشتراک" icon={<BadgeCheck className="size-5 text-primary" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            {info.plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={cn("relative rounded-2xl border-2 p-4 text-right transition", plan === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}
              >
                {p.popular && <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">پیشنهادی</span>}
                <div className="font-extrabold">{p.title}</div>
                <div className="mt-1 text-lg font-black text-primary">{money(p.price)}</div>
                {p.months > 1 && <div className="text-xs text-muted-foreground">ماهی {money(Math.round(p.price / p.months))}</div>}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {info.online && (
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="mb-1 flex items-center gap-2 font-bold"><CreditCard className="size-5 text-primary" /> پرداخت آنلاین</div>
                <p className="mb-3 text-xs text-muted-foreground">با همهٔ کارت‌های عضو شتاب؛ اشتراک بلافاصله تمدید می‌شود.</p>
                <Button className="h-11 w-full rounded-xl" disabled={busy || !chosen} onClick={payOnline}>
                  {busy ? <Loader2 className="animate-spin" /> : <>پرداخت {chosen ? money(chosen.price) : ""}</>}
                </Button>
              </div>
            )}
            {info.card && (
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="mb-1 flex items-center gap-2 font-bold"><Receipt className="size-5 text-primary" /> کارت‌به‌کارت</div>
                <p className="text-xs text-muted-foreground">مبلغ را به کارتِ زیر واریز کنید و عکسِ فیش را بفرستید:</p>
                <div className="my-2 rounded-xl bg-card p-3 text-center">
                  <b dir="ltr" className="block text-lg tracking-widest">{toFa(info.card.number.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 "))}</b>
                  <span className="text-xs text-muted-foreground">{info.card.holder}{info.card.bank ? ` · ${info.card.bank}` : ""}</span>
                </div>
                {pending ? (
                  <p className="rounded-xl bg-amber-500/15 p-2 text-center text-xs font-semibold text-amber-800 dark:text-amber-300">فیشِ شما در انتظارِ بررسی است ⏳</p>
                ) : (
                  <>
                    <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {file ? "فیش انتخاب شد ✓" : "انتخابِ عکسِ فیش"}</Button>
                      <Button className="h-11 rounded-xl" disabled={!file || busy} onClick={sendReceipt}>{busy ? <Loader2 className="animate-spin" /> : "ارسال"}</Button>
                    </div>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیح (اختیاری): ۴ رقمِ آخرِ کارت، ساعتِ واریز…" className={cn(inputCls, "mt-2")} />
                  </>
                )}
              </div>
            )}
            {!info.online && !info.card && (
              <p className="text-sm text-muted-foreground">برای تمدید با پشتیبانی تماس بگیرید{info.support ? `: ${info.support}` : "."}</p>
            )}
          </div>
          {info.support && (info.online || info.card) && <p className="mt-3 text-xs text-muted-foreground">پشتیبانی: <span dir="ltr">{toFa(info.support)}</span></p>}
        </Panel>
      )}

      <Panel title="تاریخچهٔ پرداخت‌ها" icon={<Receipt className="size-5 text-primary" />}>
        {info.payments.length === 0 ? <Empty text="هنوز پرداختی ثبت نشده" /> : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>{["تاریخ", "طرح", "مبلغ", "روش", "وضعیت", "کد پیگیری"].map((h) => <th key={h} className="p-2.5 text-right font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {info.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-2.5 text-muted-foreground">{faDateTime(p.createdAt)}</td>
                    <td className="p-2.5">{toFa(p.months)} ماه</td>
                    <td className="p-2.5">{p.amount ? money(p.amount) : "—"}</td>
                    <td className="p-2.5">{METHOD[p.method] || p.method}</td>
                    <td className={cn("p-2.5 font-semibold", p.status === "paid" ? "text-green-700 dark:text-green-400" : p.status === "pending" ? "text-amber-700 dark:text-amber-400" : "text-primary")}>
                      {PAY_STATUS[p.status] || p.status}
                      {p.status === "rejected" && p.note && <span className="block text-[11px] font-normal">{p.note}</span>}
                    </td>
                    <td className="p-2.5 text-muted-foreground" dir="ltr">{p.refId ? toFa(p.refId) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
