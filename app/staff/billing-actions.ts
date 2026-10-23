"use server";

import { demoFail, demoMode } from "@/lib/demo";
import crypto from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { withTenant, currentTenantRecord, tenantUrl } from "@/lib/tenant";
import { createPayment, listPayments, platformSettings, setPaymentAuthority, tenantState, markPaymentFailed, type Payment, type Plan } from "@/lib/platform";
import { readUpload, saveImageWebp } from "@/lib/images";
import { createCheckout } from "@/lib/stripe";
import { applyCoupon, audit } from "@/lib/platform-admin";
import { markPaymentPaid } from "@/lib/platform";
import type { ActionFail } from "@/lib/action-result";

/** This venue's subscription — signed-in manager only */
async function billingGuard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    return await withTenant(async () => {
      if (!(await isAuthed())) throw new Error("Not authorized — please sign in first");
      if (!currentTenantRecord()) throw new Error("Subscriptions are only available in multi-venue (SaaS) mode");
      return fn();
    });
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "Error" };
  }
}

export interface BillingInfo {
  name: string; slug: string; state: string; active: boolean; daysLeft: number; expiresAt: string; plan: string;
  plans: Plan[]; currency: string; online: boolean; card: { number: string; holder: string; bank: string } | null; support: string;
  payments: Payment[];
}
export async function staffBillingAction() {
  return billingGuard((): BillingInfo => {
    const t = currentTenantRecord()!;
    const ps = platformSettings();
    return {
      name: t.name, slug: t.slug, ...tenantState(t), expiresAt: t.expiresAt, plan: t.plan,
      plans: ps.plans, currency: ps.currency, online: !!ps.stripe.secretKey, card: ps.card.number ? ps.card : null, support: ps.support,
      payments: listPayments(t.slug, 30),
    };
  });
}

function findPlan(id: string): Plan {
  const p = platformSettings().plans.find((x) => x.id === id);
  if (!p || p.price <= 0) throw new Error("Invalid subscription plan");
  return p;
}

/** Preview a coupon on a plan */
export async function staffBillingCouponAction(planId: string, code: string) {
  return billingGuard(() => applyCoupon(code, findPlan(planId)));
}

/** 100% coupon: renew directly without payment */
function freeWithCoupon(slug: string, plan: Plan, c: { code: string; discount: number }) {
  const pay = createPayment({ slug, plan, method: "manual", amount: 0, coupon: c.code, discount: c.discount, note: `Coupon ${c.code}` });
  markPaymentPaid(pay.id, "", `Coupon ${c.code}`);
  audit(slug, "Renewed with a 100% coupon", slug, c.code);
  return { url: "/staff?billing=ok" };
}

/** Online payment: create a Stripe Checkout Session and return its URL */
export async function staffBillingPayAction(planId: string, couponCode = "") {
  return billingGuard(async () => {
    const t = currentTenantRecord()!;
    const ps = platformSettings();
    const plan = findPlan(planId);
    const c = applyCoupon(couponCode, plan);
    if (c.code && c.amount === 0) return freeWithCoupon(t.slug, plan, c);
    if (!ps.stripe.secretKey) throw new Error("Online payment is not enabled — please use bank transfer");
    const pay = createPayment({ slug: t.slug, plan, method: "stripe", amount: c.amount, coupon: c.code, discount: c.discount });
    try {
      const session = await createCheckout({
        key: ps.stripe.secretKey, amount: c.amount, currency: ps.currency,
        name: `${ps.brand || "Subscription"} — ${plan.title}`, description: `${t.name} (${t.slug})`,
        successUrl: await tenantUrl(t, `/billing/callback?pay=${pay.id}&session_id={CHECKOUT_SESSION_ID}`),
        cancelUrl: await tenantUrl(t, `/billing/callback?pay=${pay.id}&cancel=1`),
        metadata: { kind: "subscription", pay: pay.id, slug: t.slug },
      });
      setPaymentAuthority(pay.id, session.id);
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      return { url: session.url };
    } catch (e) {
      markPaymentFailed(pay.id, "failed", e instanceof Error ? e.message : "Payment gateway error");
      throw e;
    }
  });
}

/** Bank transfer: upload the receipt → the subscription is renewed once the platform admin approves it */
export async function staffBillingReceiptAction(planId: string, fd: FormData) {
  if (demoMode()) return demoFail();
  return billingGuard(async () => {
    const t = currentTenantRecord()!;
    if (!platformSettings().card.number) throw new Error("Bank transfer is not enabled");
    const plan = findPlan(planId);
    const c = applyCoupon(String(fd.get("coupon") || ""), plan);
    if (c.code && c.amount === 0) return freeWithCoupon(t.slug, plan, c);
    if (listPayments(t.slug, 50).some((p) => p.method === "card" && p.status === "pending")) {
      throw new Error("A previous receipt is still waiting for review");
    }
    const buf = await readUpload(fd);
    if (!buf) throw new Error("Please choose an image of the receipt");
    const receipt = await saveImageWebp(buf, `sub-receipt-${crypto.randomBytes(6).toString("hex")}`, 1400);
    const note = String(fd.get("note") || "").slice(0, 200);
    createPayment({ slug: t.slug, plan, method: "card", receipt, note, amount: c.amount, coupon: c.code, discount: c.discount });
    audit(t.slug, "Subscription receipt submitted", t.slug, `${c.amount} ${platformSettings().currency}${c.code ? ` · coupon ${c.code}` : ""}`);
    return { ok: true, url: "" };
  });
}
