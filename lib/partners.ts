import "server-only";
import crypto from "node:crypto";
import { listPayments, listTenants, rawGet, rawSet, tenantState } from "@/lib/platform";

/**
 * همکاران (معرف‌ها): چاپخانه، فروشندهٔ کارت‌خوان، طراح و … با لینکِ اختصاصی مشتری می‌آورند و از پرداخت‌ها پورسانت می‌گیرند.
 * لینک: /r/<code> یا ?ref=<code> ← کوکی ← هنگامِ ثبت‌نام کدِ همکار روی مجموعه ذخیره می‌شود.
 * پورسانت فقط از پرداخت‌های «پرداخت‌شده» حساب می‌شود (فقط اولین پرداخت یا همهٔ پرداخت‌ها).
 */
export interface Payout { at: string; amount: number; note: string }
export interface Partner {
  code: string; name: string; phone: string;
  /** درصدِ پورسانت از مبلغِ پرداخت‌شده */
  percent: number;
  scope: "first" | "all";
  active: boolean;
  /** کلیدِ صفحهٔ گزارشِ همکار (/partner/<token>) */
  token: string;
  note: string; createdAt: string;
  payouts: Payout[];
}
export interface PartnerReferral { slug: string; name: string; createdAt: string; state: string; paid: number; commission: number }
export interface PartnerStats { signups: number; paying: number; revenue: number; commission: number; paidOut: number; balance: number; referrals: PartnerReferral[] }

export const REF_COOKIE = "pref";
export const PARTNER_CODE = /^[a-z0-9][a-z0-9-]{2,19}$/;

export function listPartners(): Partner[] {
  return rawGet<Partner[]>("partners", []);
}
export function getPartner(code: string): Partner | undefined {
  const c = String(code || "").trim().toLowerCase();
  return c ? listPartners().find((p) => p.code === c) : undefined;
}
/** کدِ معتبرِ همکارِ فعال، برای ثبت روی مجموعهٔ تازه */
export function activeRef(code: string | undefined): string {
  const p = getPartner(code || "");
  return p && p.active ? p.code : "";
}
export function partnerByToken(token: string): Partner | undefined {
  return token && token.length >= 20 ? listPartners().find((p) => p.token === token) : undefined;
}

export function savePartner(input: Partial<Partner> & { code: string }, prevCode?: string): Partner {
  const list = listPartners();
  const prev = list.find((p) => p.code === (prevCode || input.code));
  const p: Partner = {
    code: String(input.code || "").trim().toLowerCase(),
    name: String(input.name || "").trim().slice(0, 80),
    phone: String(input.phone || "").replace(/[^\d+]/g, "").slice(0, 20),
    percent: Math.min(100, Math.max(0, Math.round(Number(input.percent) || 0))),
    scope: input.scope === "all" ? "all" : "first",
    active: input.active !== false,
    token: prev?.token || crypto.randomBytes(16).toString("hex"),
    note: String(input.note || "").slice(0, 300),
    createdAt: prev?.createdAt || new Date().toISOString(),
    payouts: prev?.payouts || [],
  };
  if (!PARTNER_CODE.test(p.code)) throw new Error("کدِ همکار: ۳ تا ۲۰ حرفِ انگلیسیِ کوچک، عدد یا خط‌تیره (مثل chap-pars)");
  if (!p.name) throw new Error("نامِ همکار را وارد کنید");
  const rest = list.filter((x) => x.code !== (prevCode || p.code));
  if (rest.some((x) => x.code === p.code)) throw new Error("همکاری با این کد وجود دارد");
  rawSet("partners", [p, ...rest]);
  return p;
}
export function deletePartner(code: string) {
  rawSet("partners", listPartners().filter((p) => p.code !== code));
}
/** ثبتِ پرداختِ پورسانت به همکار (تسویه) */
export function addPayout(code: string, amount: number, note: string) {
  const amt = Math.round(Number(amount) || 0);
  if (amt <= 0) throw new Error("مبلغ نامعتبر است");
  const list = listPartners();
  const p = list.find((x) => x.code === code);
  if (!p) throw new Error("همکار پیدا نشد");
  p.payouts = [{ at: new Date().toISOString(), amount: amt, note: String(note || "").slice(0, 200) }, ...p.payouts];
  rawSet("partners", list);
}

const STATE_FA: Record<string, string> = { trial: "آزمایشی", active: "فعال", expired: "منقضی", suspended: "تعلیق" };

export function partnerStats(p: Partner): PartnerStats {
  const tenants = listTenants().filter((t) => t.ref === p.code);
  const referrals: PartnerReferral[] = tenants.map((t) => {
    const paid = listPayments(t.slug, 1000).filter((x) => x.status === "paid").sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    const eligible = p.scope === "first" ? paid.slice(0, 1) : paid;
    return {
      slug: t.slug, name: t.name, createdAt: t.createdAt, state: STATE_FA[tenantState(t).state] || "",
      paid: paid.reduce((s, x) => s + x.amount, 0),
      commission: eligible.reduce((s, x) => s + Math.round((x.amount * p.percent) / 100), 0),
    };
  });
  const commission = referrals.reduce((s, r) => s + r.commission, 0);
  const paidOut = p.payouts.reduce((s, x) => s + x.amount, 0);
  return {
    signups: referrals.length,
    paying: referrals.filter((r) => r.paid > 0).length,
    revenue: referrals.reduce((s, r) => s + r.paid, 0),
    commission, paidOut, balance: commission - paidOut, referrals,
  };
}
