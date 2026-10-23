import "server-only";
import type { SmsSettings } from "@/lib/types";

/** Send a plain-text SMS with the given settings (used for each restaurant and for the platform itself). */
export async function sendSmsWith(sms: SmsSettings, phone: string, text: string): Promise<string> {
  if (sms.provider !== "twilio") throw new Error("No SMS provider configured — go to Settings → SMS and set up Twilio");
  if (!sms.accountSid || !sms.authToken || !sms.from) throw new Error("Twilio Account SID, Auth Token and sender are required");
  const body = new URLSearchParams({ To: phone, Body: text });
  if (/^MG[0-9a-f]{32}$/i.test(sms.from)) body.set("MessagingServiceSid", sms.from);
  else body.set("From", sms.from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sms.accountSid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${sms.accountSid}:${sms.authToken}`).toString("base64") },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok || !data.sid) throw new Error(data.message ? `Twilio: ${data.message}` : `Twilio error (${res.status})`);
  return "Sent";
}
