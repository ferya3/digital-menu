import "server-only";

/** درگاهِ زرین‌پال (API نسخهٔ ۴). مبلغ به ریال فرستاده می‌شود. */
function base(sandbox: boolean) {
  return process.env.ZARINPAL_API || (sandbox ? "https://sandbox.zarinpal.com/pg/v4/payment" : "https://payment.zarinpal.com/pg/v4/payment");
}
export function startPayUrl(authority: string, sandbox: boolean) {
  const b = process.env.ZARINPAL_STARTPAY || (sandbox ? "https://sandbox.zarinpal.com/pg/StartPay/" : "https://payment.zarinpal.com/pg/StartPay/");
  return b + encodeURIComponent(authority);
}

type ZpResp = { data?: { code?: number; authority?: string; ref_id?: number | string; message?: string } | []; errors?: { code?: number; message?: string } | [] };
async function call(url: string, body: Record<string, unknown>): Promise<ZpResp> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return (await res.json().catch(() => ({}))) as ZpResp;
}
const errMsg = (r: ZpResp) => (!Array.isArray(r.errors) && r.errors?.message) || "";

export async function zarinpalRequest(o: { merchant: string; sandbox: boolean; amountRial: number; callback: string; description: string; mobile?: string }): Promise<string> {
  const r = await call(`${base(o.sandbox)}/request.json`, {
    merchant_id: o.merchant, amount: o.amountRial, callback_url: o.callback, description: o.description,
    ...(o.mobile ? { metadata: { mobile: o.mobile } } : {}),
  }).catch(() => null);
  const d = r && !Array.isArray(r.data) ? r.data : undefined;
  if (!d || d.code !== 100 || !d.authority) throw new Error("اتصال به درگاهِ زرین‌پال انجام نشد" + (r && errMsg(r) ? `: ${errMsg(r)}` : ""));
  return d.authority;
}

/** ۱۰۰ = موفق، ۱۰۱ = قبلاً تأیید شده (هر دو یعنی پول دریافت شده) */
export async function zarinpalVerify(o: { merchant: string; sandbox: boolean; amountRial: number; authority: string }): Promise<{ ok: boolean; refId: string; message: string }> {
  const r = await call(`${base(o.sandbox)}/verify.json`, { merchant_id: o.merchant, amount: o.amountRial, authority: o.authority }).catch(() => null);
  const d = r && !Array.isArray(r.data) ? r.data : undefined;
  if (d && (d.code === 100 || d.code === 101)) return { ok: true, refId: String(d.ref_id ?? ""), message: "" };
  return { ok: false, refId: "", message: (r && errMsg(r)) || "پرداخت تأیید نشد" };
}
