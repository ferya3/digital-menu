"use server";

import crypto from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { withTenant, currentTenantRecord, tenantUrl } from "@/lib/tenant";
import { createPayment, listPayments, platformSettings, setPaymentAuthority, tenantState, markPaymentFailed, type Payment, type Plan } from "@/lib/platform";
import { readUpload, saveImageWebp } from "@/lib/images";
import { startPayUrl, zarinpalRequest } from "@/lib/zarinpal";
import type { ActionFail } from "@/lib/action-result";

/** اشتراکِ همین مجموعه — فقط برای مدیرِ واردشده */
async function billingGuard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    return await withTenant(async () => {
      if (!(await isAuthed())) throw new Error("دسترسی غیرمجاز — ابتدا وارد شوید");
      if (!currentTenantRecord()) throw new Error("اشتراک فقط در نسخهٔ چندمجموعه‌ای وجود دارد");
      return fn();
    });
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "خطا" };
  }
}

export interface BillingInfo {
  name: string; slug: string; state: string; active: boolean; daysLeft: number; expiresAt: string; plan: string;
  plans: Plan[]; online: boolean; card: { number: string; holder: string; bank: string } | null; support: string;
  payments: Payment[];
}
export async function staffBillingAction() {
  return billingGuard((): BillingInfo => {
    const t = currentTenantRecord()!;
    const ps = platformSettings();
    return {
      name: t.name, slug: t.slug, ...tenantState(t), expiresAt: t.expiresAt, plan: t.plan,
      plans: ps.plans, online: !!ps.zarinpal.merchant, card: ps.card.number ? ps.card : null, support: ps.support,
      payments: listPayments(t.slug, 30),
    };
  });
}

function findPlan(id: string): Plan {
  const p = platformSettings().plans.find((x) => x.id === id);
  if (!p || p.price <= 0) throw new Error("طرحِ اشتراک نامعتبر است");
  return p;
}

/** پرداختِ آنلاین: ساختِ تراکنش در زرین‌پال و برگرداندنِ آدرسِ درگاه */
export async function staffBillingPayAction(planId: string) {
  return billingGuard(async () => {
    const t = currentTenantRecord()!;
    const ps = platformSettings();
    if (!ps.zarinpal.merchant) throw new Error("پرداختِ آنلاین فعال نیست؛ از کارت‌به‌کارت استفاده کنید");
    const plan = findPlan(planId);
    const pay = createPayment({ slug: t.slug, plan, method: "zarinpal" });
    try {
      const authority = await zarinpalRequest({
        merchant: ps.zarinpal.merchant, sandbox: ps.zarinpal.sandbox, amountRial: plan.price * 10,
        callback: await tenantUrl(t, `/billing/callback?pay=${pay.id}`),
        description: `اشتراک ${plan.title} — ${t.name} (${t.slug})`, mobile: t.ownerPhone || undefined,
      });
      setPaymentAuthority(pay.id, authority);
      return { url: startPayUrl(authority, ps.zarinpal.sandbox) };
    } catch (e) {
      markPaymentFailed(pay.id, "failed", e instanceof Error ? e.message : "خطای درگاه");
      throw e;
    }
  });
}

/** کارت‌به‌کارت: آپلودِ فیش ← بعد از تأییدِ مدیرِ پلتفرم اشتراک تمدید می‌شود */
export async function staffBillingReceiptAction(planId: string, fd: FormData) {
  return billingGuard(async () => {
    const t = currentTenantRecord()!;
    if (!platformSettings().card.number) throw new Error("کارت‌به‌کارت فعال نیست");
    const plan = findPlan(planId);
    if (listPayments(t.slug, 50).some((p) => p.method === "card" && p.status === "pending")) {
      throw new Error("یک فیشِ قبلی هنوز در انتظارِ بررسی است");
    }
    const buf = await readUpload(fd);
    if (!buf) throw new Error("عکسِ فیش را انتخاب کنید");
    const receipt = await saveImageWebp(buf, `sub-receipt-${crypto.randomBytes(6).toString("hex")}`, 1400);
    const note = String(fd.get("note") || "").slice(0, 200);
    createPayment({ slug: t.slug, plan, method: "card", receipt, note });
    return { ok: true };
  });
}
