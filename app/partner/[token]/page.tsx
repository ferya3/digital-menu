import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform/home";
import { publicPlatform } from "@/app/platform/public";
import { onPlatformHost, platformUrl } from "@/lib/tenant";
import { partnerByToken, partnerStats } from "@/lib/partners";
import { NOINDEX } from "@/lib/seo";
import { fmtDate, money, num } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner report", ...NOINDEX };

/** Partner report page: reached via a secret link (token) — no login; shows only this partner's stats */
export default async function PartnerPage({ params }: { params: Promise<{ token: string }> }) {
  if (!(await onPlatformHost())) notFound();
  const partner = partnerByToken((await params).token);
  if (!partner) notFound();
  const p = publicPlatform();
  const s = partnerStats(partner);
  const link = await platformUrl(`/r/${partner.code}`);
  const tiles: [string, string][] = [
    ["Signups via your link", num(s.signups)],
    ["Paying venues", num(s.paying)],
    ["Total commission", money(s.commission)],
    ["Paid out to you", money(s.paidOut)],
    ["Balance", money(s.balance)],
  ];
  return (
    <PlatformShell p={p}>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-black">Hi {partner.name} 👋</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          You earn {num(partner.percent)}% commission on {partner.scope === "first" ? "the first payment" : "every payment"} of each venue that signs up through your link.
        </p>
        <div className="mt-5 rounded-3xl border border-primary/25 bg-primary/[0.05] p-4">
          <div className="text-xs font-bold text-muted-foreground">Your referral link (share it with cafés and restaurants)</div>
          <div className="mt-1.5 select-all break-all text-lg font-black">{link}</div>
          <div className="mt-1 text-xs text-muted-foreground">Your referral code: <b>{partner.code}</b> — if someone signs up without the link, they can enter this code on the signup form.</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-border bg-card p-4"><div className="text-[11px] text-muted-foreground">{k}</div><b className="mt-1 block text-lg">{v}</b></div>
          ))}
        </div>
        <h2 className="mt-8 font-black">Referred venues</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3 text-start">Venue</th><th className="p-3 text-start">Signed up</th><th className="p-3 text-start">Status</th><th className="p-3 text-start">Commission</th></tr></thead>
            <tbody>
              {s.referrals.map((r) => (
                <tr key={r.slug} className="border-t border-border"><td className="p-3 font-semibold">{r.name}</td><td className="p-3">{fmtDate(r.createdAt)}</td><td className="p-3">{r.state}</td><td className="p-3">{money(r.commission)}</td></tr>
              ))}
              {!s.referrals.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No one has signed up through your link yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {partner.payouts.length > 0 && (
          <>
            <h2 className="mt-8 font-black">Payouts</h2>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card text-sm">
              {partner.payouts.map((x, i) => <li key={i} className="flex justify-between gap-3 p-3"><span>{fmtDate(x.at)}{x.note && <span className="text-muted-foreground"> · {x.note}</span>}</span><b>{money(x.amount)}</b></li>)}
            </ul>
          </>
        )}
      </main>
    </PlatformShell>
  );
}
