"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, CreditCard, Crown, Loader2, Receipt, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDate, fmtDateTime, formatMoney, num, roundMoney } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import { staffBillingAction, staffBillingCouponAction, staffBillingPayAction, staffBillingReceiptAction, type BillingInfo } from "@/app/staff/billing-actions";
import { Empty, Panel, inputCls, useStaff } from "@/components/staff/kit";

const STATE: Record<string, { label: string; cls: string }> = {
  trial: { label: "Free trial", cls: "bg-blue-600/10 text-blue-700 dark:text-blue-400" },
  active: { label: "Active", cls: "bg-green-600/10 text-green-700 dark:text-green-400" },
  expired: { label: "Expired", cls: "bg-primary/10 text-primary" },
  suspended: { label: "Suspended", cls: "bg-muted text-muted-foreground" },
};
const PAY_STATUS: Record<string, string> = { pending: "Pending review", paid: "Paid ✓", failed: "Failed", rejected: "Rejected", cancelled: "Cancelled" };
const METHOD: Record<string, string> = { stripe: "Online (Stripe)", card: "Bank transfer", manual: "Manual" };

/** Venue subscription: status, online renewal (Stripe) or bank transfer with a receipt */
export function BillingSection() {
  const { flash } = useStaff();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  // Coupon: the final amount is shown after "Apply"
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; amount: number; plan: string } | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    staffBillingAction().then((r) => {
      const i = unwrap(r);
      setInfo(i);
      setPlan((p) => p || i.plans.find((x) => x.popular)?.id || i.plans[0]?.id || "");
    }).catch((e) => flash("❌ " + (e instanceof Error ? e.message : "Error")));
  }, [flash]);
  useEffect(load, [load]);

  if (!info) return <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  const st = STATE[info.state] || STATE.active;
  const chosen = info.plans.find((p) => p.id === plan);
  const pending = info.payments.some((p) => p.status === "pending" && p.method === "card");
  const ap = applied && applied.plan === plan ? applied : null;
  const finalPrice = ap ? ap.amount : chosen?.price || 0;
  const money = (n: number) => formatMoney(n, info.currency);
  const forever = info.expiresAt.startsWith("2099");

  async function applyCoupon() {
    setCouponErr("");
    try { setApplied({ ...unwrap(await staffBillingCouponAction(plan, coupon)), plan }); }
    catch (e) { setApplied(null); setCouponErr(e instanceof Error ? e.message : "Error"); }
  }

  async function payOnline() {
    setBusy(true);
    try {
      const { url } = unwrap(await staffBillingPayAction(plan, ap?.code || ""));
      window.location.href = url;
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Error")); setBusy(false); }
  }
  async function sendReceipt() {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file, 1600, 0.85);
      const r = unwrap(await staffBillingReceiptAction(plan, imageForm(blob, { note, coupon: ap?.code || "" })));
      if ("url" in r && r.url) { window.location.href = r.url; return; }
      flash("✅ Receipt sent — your subscription will renew automatically once it's approved");
      setFile(null); setNote("");
      load();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Error")); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Panel title="Subscription status" icon={<Crown className="size-5 text-primary" />}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className={cn("rounded-full px-3 py-1 text-sm font-bold", st.cls)}>{st.label}</span>
          <div>
            <div className="text-xs text-muted-foreground">Valid until</div>
            <b>{forever ? "Unlimited" : fmtDate(info.expiresAt)}</b>
          </div>
          {!forever && (
            <div>
              <div className="text-xs text-muted-foreground">Remaining</div>
              <b className={cn(info.daysLeft <= 7 && "text-primary")}>{info.daysLeft > 0 ? `${num(info.daysLeft)} day${info.daysLeft === 1 ? "" : "s"}` : "Ended"}</b>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Menu address</div>
            <b>{info.slug}</b>
          </div>
        </div>
        {!info.active && (
          <p className="mt-3 rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">
            {info.state === "suspended" ? "This venue has been suspended by support." : "Your subscription has ended and the customer menu is offline."} Renew to bring everything (menu, orders, settings) back online.
          </p>
        )}
      </Panel>

      {info.state !== "suspended" && !forever && (
        <Panel title="Renew subscription" icon={<BadgeCheck className="size-5 text-primary" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            {info.plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={cn("relative rounded-2xl border-2 p-4 text-left transition", plan === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}
              >
                {p.popular && <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">Popular</span>}
                <div className="font-extrabold">{p.title}</div>
                <div className="mt-1 text-lg font-black text-primary">{money(p.price)}</div>
                {p.months > 1 && <div className="text-xs text-muted-foreground">{money(roundMoney(p.price / p.months))} / month</div>}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input value={coupon} onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setApplied(null); setCouponErr(""); }} placeholder="Coupon code" className={cn(inputCls, "max-w-48 py-2")} />
            <Button variant="outline" className="h-10 rounded-xl" disabled={!coupon.trim()} onClick={applyCoupon}>Apply</Button>
            {ap && <span className="text-sm font-semibold text-green-700 dark:text-green-400">✓ {money(ap.discount)} off — total: {money(ap.amount)}</span>}
            {couponErr && <span className="text-sm font-semibold text-primary">{couponErr}</span>}
          </div>
          {ap && ap.amount === 0 && (
            <Button className="mt-3 h-11 rounded-xl" disabled={busy} onClick={payOnline}>{busy ? <Loader2 className="animate-spin" /> : "Activate free with this coupon"}</Button>
          )}

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {info.online && (
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="mb-1 flex items-center gap-2 font-bold"><CreditCard className="size-5 text-primary" /> Pay online</div>
                <p className="mb-3 text-xs text-muted-foreground">Pay securely by card with Stripe; your subscription renews instantly.</p>
                <Button className="h-11 w-full rounded-xl" disabled={busy || !chosen} onClick={payOnline}>
                  {busy ? <Loader2 className="animate-spin" /> : finalPrice === 0 && ap ? <>Activate with coupon</> : <>Pay {chosen ? money(finalPrice) : ""}</>}
                </Button>
              </div>
            )}
            {info.card && (
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="mb-1 flex items-center gap-2 font-bold"><Receipt className="size-5 text-primary" /> Bank transfer</div>
                <p className="text-xs text-muted-foreground">Transfer {chosen ? <b>{money(finalPrice)}</b> : "the amount"} to the account below and upload a photo of the receipt:</p>
                <div className="my-2 rounded-xl bg-card p-3 text-center">
                  <b className="block break-all text-lg tracking-wide select-all">{info.card.number}</b>
                  <span className="text-xs text-muted-foreground">{info.card.holder}{info.card.bank ? ` · ${info.card.bank}` : ""}</span>
                </div>
                {pending ? (
                  <p className="rounded-xl bg-amber-500/15 p-2 text-center text-xs font-semibold text-amber-800 dark:text-amber-300">Your receipt is awaiting review ⏳</p>
                ) : (
                  <>
                    <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {file ? "Receipt selected ✓" : "Choose receipt image"}</Button>
                      <Button className="h-11 rounded-xl" disabled={!file || busy} onClick={sendReceipt}>{busy ? <Loader2 className="animate-spin" /> : "Send"}</Button>
                    </div>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional): reference number, transfer time…" className={cn(inputCls, "mt-2")} />
                  </>
                )}
              </div>
            )}
            {!info.online && !info.card && (
              <p className="text-sm text-muted-foreground">To renew, please contact support{info.support ? `: ${info.support}` : "."}</p>
            )}
          </div>
          {info.support && (info.online || info.card) && <p className="mt-3 text-xs text-muted-foreground">Support: <span>{info.support}</span></p>}
        </Panel>
      )}

      <Panel title="Payment history" icon={<Receipt className="size-5 text-primary" />}>
        {info.payments.length === 0 ? <Empty text="No payments yet" /> : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>{["Date", "Plan", "Amount", "Method", "Status", "Reference"].map((h) => <th key={h} className="p-2.5 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {info.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-2.5 text-muted-foreground">{fmtDateTime(p.createdAt)}</td>
                    <td className="p-2.5">{num(p.months)} month{p.months === 1 ? "" : "s"}</td>
                    <td className="p-2.5">{p.amount ? money(p.amount) : "—"}</td>
                    <td className="p-2.5">{METHOD[p.method] || p.method}</td>
                    <td className={cn("p-2.5 font-semibold", p.status === "paid" ? "text-green-700 dark:text-green-400" : p.status === "pending" ? "text-amber-700 dark:text-amber-400" : "text-primary")}>
                      {PAY_STATUS[p.status] || p.status}
                      {p.status === "rejected" && p.note && <span className="block text-[11px] font-normal">{p.note}</span>}
                    </td>
                    <td className="max-w-40 truncate p-2.5 text-muted-foreground" title={p.refId || ""}>{p.refId || "—"}</td>
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
