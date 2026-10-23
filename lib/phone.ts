/**
 * Phone numbers are stored in E.164 (+15551234567).
 * Local numbers ("0…" or without a country code) get the default country calling code from
 * the DEFAULT_COUNTRY_CODE environment variable (e.g. "1" for US/Canada, "44" for the UK).
 */
export function defaultCountryCode(): string {
  return (typeof process !== "undefined" ? process.env.DEFAULT_COUNTRY_CODE || "" : "").replace(/\D/g, "");
}

export function normalizePhone(raw: string, cc: string = defaultCountryCode()): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (s.startsWith("+")) return "+" + digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (cc) {
    if (digits.startsWith("0")) return "+" + cc + digits.replace(/^0+/, "");
    if (digits.length <= 10) return "+" + cc + digits;
  }
  return "+" + digits;
}

export const isValidPhone = (p: string) => /^\+[1-9]\d{7,14}$/.test(p);

/** Short masked form for lists, e.g. +1 555 ••• 4567 */
export const maskPhone = (p: string) => (p.length > 8 ? `${p.slice(0, p.length - 7)} ••• ${p.slice(-4)}` : p);
