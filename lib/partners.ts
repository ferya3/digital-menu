import "server-only";
import crypto from "node:crypto";
import { listPayments, listTenants, rawGet, rawSet, tenantState } from "@/lib/platform";
import { roundMoney } from "@/lib/utils";

/**
 * Partners (referrers): print shops, POS resellers, designers, etc. bring customers via a personal link and earn commission on payments.
 * Link: /r/<code> or ?ref=<code> → cookie → on signup the partner code is stored on the venue.
 * Commission is only counted on "paid" payments (first payment only, or all payments).
 */
export interface Payout { at: string; amount: number; note: string }
export interface Partner {
  code: string; name: string; phone: string;
  /** Commission percentage of the paid amount */
  percent: number;
  scope: "first" | "all";
  active: boolean;
  /** Key for the partner's report page (/partner/<token>) */
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
/** Valid code of an active partner, to store on a new venue */
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
  if (!PARTNER_CODE.test(p.code)) throw new Error("Partner code: 3–20 lowercase letters, digits or hyphens (e.g. print-shop)");
  if (!p.name) throw new Error("Please enter the partner's name");
  const rest = list.filter((x) => x.code !== (prevCode || p.code));
  if (rest.some((x) => x.code === p.code)) throw new Error("A partner with this code already exists");
  rawSet("partners", [p, ...rest]);
  return p;
}
export function deletePartner(code: string) {
  rawSet("partners", listPartners().filter((p) => p.code !== code));
}
/** Records a commission payout to a partner (settlement) */
export function addPayout(code: string, amount: number, note: string) {
  const amt = roundMoney(Number(amount) || 0);
  if (amt <= 0) throw new Error("Invalid amount");
  const list = listPartners();
  const p = list.find((x) => x.code === code);
  if (!p) throw new Error("Partner not found");
  p.payouts = [{ at: new Date().toISOString(), amount: amt, note: String(note || "").slice(0, 200) }, ...p.payouts];
  rawSet("partners", list);
}

const STATE_LABEL: Record<string, string> = { trial: "Trial", active: "Active", expired: "Expired", suspended: "Suspended" };

export function partnerStats(p: Partner): PartnerStats {
  const tenants = listTenants().filter((t) => t.ref === p.code);
  const referrals: PartnerReferral[] = tenants.map((t) => {
    const paid = listPayments(t.slug, 1000).filter((x) => x.status === "paid").sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    const eligible = p.scope === "first" ? paid.slice(0, 1) : paid;
    return {
      slug: t.slug, name: t.name, createdAt: t.createdAt, state: STATE_LABEL[tenantState(t).state] || "",
      paid: paid.reduce((s, x) => s + x.amount, 0),
      commission: roundMoney(eligible.reduce((s, x) => s + (x.amount * p.percent) / 100, 0)),
    };
  });
  const commission = roundMoney(referrals.reduce((s, r) => s + r.commission, 0));
  const paidOut = p.payouts.reduce((s, x) => s + x.amount, 0);
  return {
    signups: referrals.length,
    paying: referrals.filter((r) => r.paid > 0).length,
    revenue: referrals.reduce((s, r) => s + r.paid, 0),
    commission, paidOut, balance: roundMoney(commission - paidOut), referrals,
  };
}
