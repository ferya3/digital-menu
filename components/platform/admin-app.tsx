"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban, CalendarPlus, Check, CircleDollarSign, Download, ExternalLink, FileText, Globe, History, KeyRound, LayoutDashboard,
  Loader2, LogIn, LogOut, Megaphone, Menu as MenuIcon, MessageSquareText, Newspaper, Handshake, MapPin, Pencil, Percent, Plus, Receipt, Search, Settings, Store, Trash2, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn, fmtDate, fmtDateTime, getPlatformCurrency, money, num, parsePrice, setPlatformCurrency } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import {
  adminCreateTenantAction, adminDataAction, adminDeleteTenantAction, adminEnterAction, adminExtendAction, adminLoginAction,
  adminLogoutAction, adminOwnerSmsAction, adminPaymentAction, adminResetPasswordAction, adminSaveSettingsAction,
  adminSetPasswordAction, adminStatusAction, adminTestSmsAction, adminUpdateTenantAction, type AdminData, type AdminTenant,
} from "@/app/platform/actions";
import { KIND_LABEL, type BusinessKind } from "@/lib/seeds";
import type { PlatformSettings } from "@/lib/platform";
import { Box, L, Modal, STATE, Toggle, downloadCsv, err, fieldCls, smallField, type Flash } from "@/components/platform/admin/shared";
import { Dashboard } from "@/components/platform/admin/dashboard";
import { ContentEditor } from "@/components/platform/admin/content-editor";
import { Articles } from "@/components/platform/admin/articles";
import { Partners } from "@/components/platform/admin/partners";
import { Cities } from "@/components/platform/admin/cities";
import { Coupons } from "@/components/platform/admin/coupons";
import { Notify } from "@/components/platform/admin/notify";
import { AuditLog } from "@/components/platform/admin/audit";
import { PlatformCustomers } from "@/components/platform/admin/customers";

const PAY: Record<string, string> = { pending: "Pending", paid: "Paid", failed: "Failed", rejected: "Rejected" };
const METHOD: Record<string, string> = { stripe: "Online (Stripe)", card: "Bank transfer", manual: "Manual" };

type Section = "dashboard" | "tenants" | "customers" | "payments" | "coupons" | "content" | "articles" | "cities" | "partners" | "notify" | "audit" | "settings";
const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tenants", label: "Venues", icon: Store },
  { id: "customers", label: "Venue customers", icon: Users },
  { id: "payments", label: "Payments", icon: CircleDollarSign },
  { id: "coupons", label: "Coupons", icon: Percent },
  { id: "content", label: "Site content", icon: FileText },
  { id: "articles", label: "Articles (blog)", icon: Newspaper },
  { id: "cities", label: "City pages", icon: MapPin },
  { id: "partners", label: "Partners (referrals)", icon: Handshake },
  { id: "notify", label: "Notifications", icon: Megaphone },
  { id: "audit", label: "Activity log", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminApp() {
  const [status, setStatus] = useState<{ authed: boolean; configured: boolean } | null>(null);
  useEffect(() => { adminStatusAction().then(setStatus); }, []);
  if (!status) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  if (!status.authed) return <AdminLogin configured={status.configured} onDone={() => setStatus({ ...status, authed: true })} />;
  return <AdminPanel onLogout={() => setStatus({ ...status, authed: false })} />;
}

function AdminLogin({ configured, onDone }: { configured: boolean; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [e, setE] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <form
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl"
        onSubmit={async (ev) => {
          ev.preventDefault(); setBusy(true); setE("");
          try { unwrap(await adminLoginAction(pw)); onDone(); } catch (x) { setE(err(x)); } finally { setBusy(false); }
        }}
      >
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Store className="size-7" /></span>
        <h1 className="mt-3 text-center text-xl font-black">Platform admin</h1>
        {!configured && <p className="mt-3 rounded-2xl bg-amber-500/15 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300">The admin password is not set on the server (PLATFORM_ADMIN_PASSWORD in set-saas.sh).</p>}
        <input type="password" autoFocus value={pw} onChange={(x) => setPw(x.target.value)} placeholder="Admin password" className={cn(fieldCls, "mt-5")} />
        {e && <p className="mt-2 text-sm font-semibold text-primary">{e}</p>}
        <Button type="submit" className="mt-4 h-11 w-full rounded-2xl" disabled={busy || !pw}>{busy ? <Loader2 className="animate-spin" /> : "Log in"}</Button>
      </form>
    </main>
  );
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [customersSlug, setCustomersSlug] = useState("");
  const [side, setSide] = useState(false);
  const [toast, setToast] = useState("");
  const flash = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast(""), 4000); }, []);
  const load = useCallback(() => {
    adminDataAction().then((r) => {
      const d = unwrap(r);
      setPlatformCurrency(d.settings.currency); // amounts render in the platform currency
      setData(d);
    }).catch((e) => { if (/log in first/i.test(err(e))) onLogout(); else flash("❌ " + err(e)); });
  }, [flash, onLogout]);
  useEffect(load, [load]);

  const pending = data?.payments.filter((p) => p.status === "pending" && p.method === "card").length || 0;
  // Data refreshes on every section change (new payments/signups show up without a page reload)
  const go = (s: Section) => { setSection(s); setSide(false); window.scrollTo({ top: 0 }); load(); if (s !== "customers") setCustomersSlug(""); };
  const openTenant = (slug: string) => { setOpenSlug(slug); go("tenants"); };
  const siteUrl = data ? `${window.location.protocol}//${window.location.host}/` : "/";

  const nav = (
    <nav className="space-y-1">
      {NAV.map((n) => (
        <button key={n.id} onClick={() => go(n.id)}
          className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start text-sm font-semibold transition", section === n.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <n.icon className="size-[18px] shrink-0" />
          <span className="flex-1">{n.label}</span>
          {n.id === "payments" && pending > 0 && <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold", section === n.id ? "bg-white text-primary" : "bg-primary text-primary-foreground")}>{num(pending)}</span>}
        </button>
      ))}
    </nav>
  );
  const brand = (
    <div className="mb-5 flex items-center gap-2.5 px-2">
      <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Store className="size-5" /></span>
      <div className="leading-tight"><b className="block">Platform admin</b><a href="/" target="_blank" className="text-[11px] text-muted-foreground hover:text-primary">View site ↗</a></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:ps-60">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 border-e border-border bg-card p-4 lg:block">{brand}{nav}</aside>
      {side && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setSide(false)}>
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[84vw] bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSide(false)} aria-label="Close" className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-muted"><X className="size-5" /></button>
            {brand}{nav}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu" onClick={() => setSide(true)}><MenuIcon /></Button>
          <h1 className="flex-1 truncate text-lg font-extrabold">{NAV.find((n) => n.id === section)!.label}</h1>
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Log out" title="Log out" onClick={async () => { await adminLogoutAction(); onLogout(); }}><LogOut /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        {!data ? <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
          : section === "dashboard" ? <Dashboard flash={flash} onOpenTenant={openTenant} />
          : section === "tenants" ? <Tenants data={data} reload={load} flash={flash} openSlug={openSlug} setOpenSlug={setOpenSlug} onCustomers={(s) => { setOpenSlug(null); setCustomersSlug(s); go("customers"); }} />
          : section === "customers" ? <PlatformCustomers flash={flash} initialSlug={customersSlug} />
          : section === "payments" ? <Payments data={data} reload={load} flash={flash} />
          : section === "coupons" ? <Coupons flash={flash} plans={data.settings.plans} />
          : section === "content" ? <ContentEditor flash={flash} siteUrl={siteUrl} trialDays={data.settings.trialDays} />
          : section === "articles" ? <Articles flash={flash} siteUrl={siteUrl} />
          : section === "cities" ? <Cities flash={flash} siteUrl={siteUrl} />
          : section === "partners" ? <Partners flash={flash} />
          : section === "notify" ? <Notify flash={flash} />
          : section === "audit" ? <AuditLog flash={flash} />
          : <PlatformSettingsForm initial={data.settings} root={data.root} reload={load} flash={flash} />}
      </main>
      {toast && <div className="fixed inset-x-0 top-3 z-[80] mx-auto w-fit max-w-[92vw] rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background shadow-lg">{toast}</div>}
    </div>
  );
}

type Tools = { data: AdminData; reload: () => void; flash: Flash };

/* ============================ Venues ============================ */
function Tenants({ data, reload, flash, openSlug, setOpenSlug, onCustomers }: Tools & { openSlug: string | null; setOpenSlug: (s: string | null) => void; onCustomers: (slug: string) => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "trial" | "active" | "expired" | "suspended">("all");
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => data.tenants.filter((t) =>
    (filter === "all" || t.state === filter) &&
    (!q || [t.name, t.slug, t.ownerPhone, t.ownerName, t.domain].some((x) => x.toLowerCase().includes(q.toLowerCase())))
  ), [data.tenants, q, filter]);
  const count = (s: string) => data.tenants.filter((t) => t.state === s).length;
  const sel = data.tenants.find((t) => t.slug === openSlug);

  function exportCsv() {
    downloadCsv("tenants.csv", [
      ["Name", "Address", "Type", "Owner", "Phone", "Status", "Valid until", "Signed up", "Orders", "Items", "Customers", "Sales (30 days)", "Custom domain", "Note"],
      ...list.map((t) => [t.name, t.slug, KIND_LABEL[t.kind], t.ownerName, t.ownerPhone, STATE[t.state].label, t.expiresAt.slice(0, 10), t.createdAt.slice(0, 10), t.stats.orders, t.stats.items, t.stats.customers, t.stats.revenue30, t.domain, t.note]),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["All venues", data.tenants.length], ["Active", count("active")], ["Trial", count("trial")], ["Expired / suspended", count("expired") + count("suspended")]].map(([k, v]) => (
          <div key={k} className="rounded-3xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><b className="mt-1 block text-lg">{num(v)}</b></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: name, address, phone…" className={cn(fieldCls, "py-2.5 ps-9")} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={cn(fieldCls, "w-auto py-2.5")}>
          <option value="all">All</option><option value="active">Active</option><option value="trial">Trial</option><option value="expired">Expired</option><option value="suspended">Suspended</option>
        </select>
        <Button variant="outline" className="rounded-2xl" onClick={exportCsv} disabled={!list.length}><Download className="size-4" /> CSV</Button>
        <Button className="rounded-2xl" onClick={() => setCreating(true)}><Plus className="size-4" /> New venue</Button>
      </div>

      {list.length === 0 ? <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">No venues</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <button key={t.slug} onClick={() => setOpenSlug(t.slug)} className="rounded-3xl border border-border bg-card p-4 text-start shadow-sm transition hover:border-primary/40">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{t.name}</b>
                  <span className="block truncate text-xs text-muted-foreground">{t.domain || `${t.slug}.${data.root}`}</span>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", STATE[t.state].cls)}>{STATE[t.state].label}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{KIND_LABEL[t.kind]?.split(/ [/(]/)[0]}</span>
                {t.ownerPhone && <span>{num(t.ownerPhone)}</span>}
                <span>{t.expiresAt.startsWith("2099") ? "No expiry" : t.daysLeft > 0 ? `${num(t.daysLeft)} ${t.daysLeft === 1 ? "day" : "days"} left` : `Expired ${fmtDate(t.expiresAt)}`}</span>
                <span>{num(t.stats.orders)} orders</span>
                <span>{num(t.stats.items)} items</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {sel && <TenantDrawer t={sel} data={data} onClose={() => setOpenSlug(null)} reload={reload} flash={flash} onCustomers={() => onCustomers(sel.slug)} />}
      {creating && <CreateTenant root={data.root} trial={data.settings.trialDays} onClose={() => setCreating(false)} reload={reload} flash={flash} />}
    </div>
  );
}

function TenantDrawer({ t, data, onClose, reload, flash, onCustomers }: { t: AdminTenant; onClose: () => void; onCustomers: () => void } & Tools) {
  const [busy, setBusy] = useState("");
  const [info, setInfo] = useState({ name: t.name, ownerName: t.ownerName, ownerPhone: t.ownerPhone, kind: t.kind });
  const [editing, setEditing] = useState(false);
  const [domain, setDomain] = useState(t.domain);
  const [note, setNote] = useState(t.note);
  const [until, setUntil] = useState("");
  const [amount, setAmount] = useState("");
  const [pw, setPw] = useState("");
  const [sms, setSms] = useState("");
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) flash(ok); reload(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(""); }
  };
  const extend = (o: { months?: number; days?: number; until?: string; amount?: number }, label: string) =>
    run("ext", async () => unwrap(await adminExtendAction(t.slug, o)), `✅ ${label}`);
  const payments = data.payments.filter((p) => p.slug === t.slug).slice(0, 8);

  return (
    <Modal title={t.name} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATE[t.state].cls)}>{STATE[t.state].label}</span>
        <a href={t.url} target="_blank" rel="noopener" className="flex items-center gap-1 font-semibold text-primary">{t.domain || `${t.slug}.${data.root}`} <ExternalLink className="size-3.5" /></a>
        <button onClick={() => setEditing((v) => !v)} className="ms-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /> Edit details</button>
      </div>

      {editing ? (
        <div className="mb-3 grid gap-2 rounded-2xl bg-muted/50 p-3 sm:grid-cols-2">
          <L t="Venue name"><input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className={smallField} /></L>
          <L t="Type"><select value={info.kind} onChange={(e) => setInfo({ ...info, kind: e.target.value as BusinessKind })} className={smallField}>{(Object.keys(KIND_LABEL) as BusinessKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></L>
          <L t="Owner name"><input value={info.ownerName} onChange={(e) => setInfo({ ...info, ownerName: e.target.value })} className={smallField} /></L>
          <L t="Owner phone"><input type="tel" value={info.ownerPhone} onChange={(e) => setInfo({ ...info, ownerPhone: e.target.value })} placeholder="+1 555 123 4567" className={smallField} /></L>
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" className="rounded-xl" disabled={!!busy} onClick={() => run("info", async () => { unwrap(await adminUpdateTenantAction(t.slug, info)); setEditing(false); }, "✅ Details saved")}>Save</Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-muted/50 p-3 text-sm">
          <dt className="text-muted-foreground">Owner</dt><dd>{t.ownerName || "—"} <span>{t.ownerPhone ? num(t.ownerPhone) : ""}</span></dd>
          <dt className="text-muted-foreground">Type</dt><dd>{KIND_LABEL[t.kind]}</dd>
          <dt className="text-muted-foreground">Signed up</dt><dd>{fmtDate(t.createdAt)}</dd>
          <dt className="text-muted-foreground">Valid until</dt><dd>{t.expiresAt.startsWith("2099") ? "No expiry" : `${fmtDate(t.expiresAt)} (${t.daysLeft > 0 ? `${num(t.daysLeft)} ${t.daysLeft === 1 ? "day" : "days"}` : "expired"})`}</dd>
          <dt className="text-muted-foreground">Last active</dt><dd>{t.lastSeen ? fmtDateTime(t.lastSeen) : "—"}</dd>
          <dt className="text-muted-foreground">Stats</dt><dd>{num(t.stats.orders)} orders · <button onClick={onCustomers} className="font-semibold text-primary underline-offset-2 hover:underline">{num(t.stats.customers)} customer numbers</button> · 30-day sales {money(t.stats.revenue30)}</dd>
        </dl>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button className="rounded-xl" disabled={!!busy} onClick={() => run("enter", async () => { const r = unwrap(await adminEnterAction(t.slug)); window.open(r.url, "_blank"); })}>
          {busy === "enter" ? <Loader2 className="animate-spin" /> : <><LogIn className="size-4" /> Open dashboard</>}
        </Button>
        <Button variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => run("pw", async () => setPw(unwrap(await adminResetPasswordAction(t.slug)).password))}>
          <KeyRound className="size-4" /> New password
        </Button>
      </div>
      {pw && <p className="mt-2 rounded-2xl bg-green-600/10 p-3 text-center text-sm">New dashboard password: <b className="select-all text-base">{pw}</b><br /><span className="text-xs text-muted-foreground">Give it to the venue owner — it won’t be shown again.</span></p>}

      <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-extrabold"><CalendarPlus className="size-4 text-primary" /> Extend / change subscription</h3>
      <div className="flex flex-wrap gap-2">
        {[[1, "1 month"], [3, "3 months"], [6, "6 months"], [12, "1 year"]].map(([m, l]) => (
          <Button key={m} size="sm" variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => extend({ months: Number(m), amount: parsePrice(amount) }, `Extended by ${l}`)}>+{l}</Button>
        ))}
        <Button size="sm" variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => extend({ days: 7 }, "7 days added")}>+7 days</Button>
      </div>
      <L t={`Amount received offline (optional, ${getPlatformCurrency()})`} hint="If you were paid in person or by bank transfer, enter it before pressing an extend button so it counts toward revenue">
        <input type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(smallField, "max-w-48")} />
      </L>
      <div className="mt-2 flex gap-2">
        <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={cn(fieldCls, "py-2")} />
        <Button size="sm" variant="outline" className="h-auto shrink-0 rounded-xl" disabled={!until || !!busy} onClick={() => extend({ until }, "Expiry date set")}>Set date</Button>
      </div>

      {t.ownerPhone && (
        <>
          <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-extrabold"><MessageSquareText className="size-4 text-primary" /> SMS to the owner</h3>
          <div className="flex gap-2">
            <textarea value={sms} onChange={(e) => setSms(e.target.value)} rows={2} placeholder="Message text (you can use {name}, {days}, {link})" className={cn(smallField, "resize-y")} />
            <Button size="sm" className="h-auto shrink-0 rounded-xl" disabled={!sms.trim() || !!busy} onClick={() => run("sms", async () => { unwrap(await adminOwnerSmsAction(sms, "all", t.slug)); setSms(""); }, "✅ SMS sent")}>Send</Button>
          </div>
        </>
      )}

      <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-extrabold"><Globe className="size-4 text-primary" /> Custom domain (optional)</h3>
      <div className="flex gap-2">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="menu.example.com" className={cn(fieldCls, "py-2")} />
        <Button size="sm" variant="outline" className="h-auto shrink-0 rounded-xl" disabled={!!busy || domain === t.domain}
          onClick={() => run("dom", async () => unwrap(await adminUpdateTenantAction(t.slug, { domain })), "✅ Domain saved")}>Save</Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">The domain’s A record must point to this server’s IP; an HTTPS certificate is issued automatically.</p>

      <h3 className="mb-2 mt-5 font-extrabold">Internal note</h3>
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={cn(fieldCls, "py-2")} />
        <Button size="sm" variant="outline" className="h-auto shrink-0 rounded-xl" disabled={!!busy || note === t.note}
          onClick={() => run("note", async () => unwrap(await adminUpdateTenantAction(t.slug, { note })), "✅ Saved")}>Save</Button>
      </div>

      {payments.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 font-extrabold">Payments</h3>
          <div className="space-y-1 text-xs">
            {payments.map((p) => <div key={p.id} className="flex justify-between rounded-xl bg-muted/50 px-3 py-2"><span>{fmtDate(p.createdAt)} · {num(p.months)} mo · {METHOD[p.method] || p.method}{p.coupon ? ` · code ${p.coupon}` : ""}</span><span>{p.amount ? money(p.amount) : "—"} · {PAY[p.status]}</span></div>)}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" className="rounded-xl" disabled={!!busy}
          onClick={() => run("sus", async () => unwrap(await adminUpdateTenantAction(t.slug, { status: t.status === "suspended" ? "active" : "suspended" })), t.status === "suspended" ? "✅ Reactivated" : "Venue suspended")}>
          {t.status === "suspended" ? <><Check className="size-4" /> Reactivate</> : <><Ban className="size-4" /> Suspend</>}
        </Button>
        <Button variant="ghost" className="rounded-xl text-primary" disabled={!!busy}
          onClick={() => {
            const c = prompt(`To delete "${t.name}", type its address (${t.slug}).\nIts data will be moved to the data/deleted folder.`);
            if (c) run("del", async () => { unwrap(await adminDeleteTenantAction(t.slug, c.trim())); onClose(); }, "Venue deleted");
          }}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </Modal>
  );
}

function CreateTenant({ root, trial, onClose, reload, flash }: { root: string; trial: number; onClose: () => void; reload: () => void; flash: Flash }) {
  const [f, setF] = useState({ name: "", slug: "", kind: "cafe" as BusinessKind, ownerName: "", phone: "", password: "", months: 0, sample: true });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Modal title="New venue" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { unwrap(await adminCreateTenantAction(f)); flash(`✅ ${f.name} created`); reload(); onClose(); } catch (x) { flash("❌ " + err(x)); } finally { setBusy(false); }
      }}>
        <input required value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Venue name" className={fieldCls} />
        <div className="flex items-center overflow-hidden rounded-2xl border border-border">
          <input required value={f.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="address" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none" />
          <span className="bg-muted px-3 py-3 text-sm text-muted-foreground">.{root}</span>
        </div>
        <select value={f.kind} onChange={(e) => set({ kind: e.target.value as BusinessKind })} className={fieldCls}>
          {(Object.keys(KIND_LABEL) as BusinessKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input value={f.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder="Owner name" className={fieldCls} />
          <input type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="Phone (+1 555 123 4567)" className={fieldCls} />
        </div>
        <input required minLength={8} value={f.password} onChange={(e) => set({ password: e.target.value })} placeholder="Dashboard password (min. 8 characters)" className={fieldCls} />
        <select value={f.months} onChange={(e) => set({ months: Number(e.target.value) })} className={fieldCls}>
          <option value={0}>Free trial ({num(trial)} days)</option>
          {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{num(m)}-month subscription (paid offline)</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.sample} onChange={(e) => set({ sample: e.target.checked })} /> Add a sample menu</label>
        <Button type="submit" className="h-11 w-full rounded-2xl" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Create"}</Button>
      </form>
    </Modal>
  );
}

/* ============================ Payments ============================ */
function Payments({ data, reload, flash }: Tools) {
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "failed" | "rejected">("all");
  const [method, setMethod] = useState<"all" | "stripe" | "card" | "manual">("all");
  const decide = async (id: string, approve: boolean) => {
    let note = "";
    if (!approve) { const r = prompt("Reason for rejecting (shown to the venue):", "We couldn’t find this transfer"); if (r === null) return; note = r; }
    setBusy(id);
    try { unwrap(await adminPaymentAction(id, approve, note)); flash(approve ? "✅ Approved — subscription extended" : "Rejected"); reload(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(""); }
  };
  const pending = data.payments.filter((p) => p.status === "pending" && p.method === "card");
  const list = data.payments.filter((p) => (status === "all" || p.status === status) && (method === "all" || p.method === method));
  const total = list.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  return (
    <div className="space-y-4">
      <Box title="Bank transfer receipts to review" action={<Receipt className="size-5 text-primary" />}>
        {pending.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No receipts waiting</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-2xl border border-border p-3">
                {p.receiptUrl && (
                  <a href={p.receiptUrl} target="_blank" rel="noopener" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.receiptUrl} alt="Receipt" className="h-28 w-20 rounded-xl object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <b className="block">{p.tenantName}</b>
                  <span className="block text-xs text-muted-foreground">{fmtDateTime(p.createdAt)}</span>
                  <span className="mt-1 block">{num(p.months)} mo · <b>{money(p.amount)}</b>{p.coupon ? <span className="text-xs text-muted-foreground"> (code {p.coupon}: −{money(p.discount)})</span> : null}</span>
                  {p.note && <span className="block text-xs text-muted-foreground">“{p.note}”</span>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-8 rounded-xl" disabled={!!busy} onClick={() => decide(p.id, true)}>{busy === p.id ? <Loader2 className="animate-spin" /> : <><Check className="size-4" /> Approve</>}</Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={!!busy} onClick={() => decide(p.id, false)}>Reject</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Box>
      <Box title="All payments" action={
        <Button size="sm" variant="outline" className="rounded-xl" disabled={!list.length} onClick={() => downloadCsv("payments.csv", [
          ["Date", "Venue", "Months", `Amount (${getPlatformCurrency()})`, "Coupon", "Discount", "Method", "Status", "Reference", "Note"],
          ...list.map((p) => [p.createdAt, p.tenantName, p.months, p.amount, p.coupon, p.discount, METHOD[p.method] || p.method, PAY[p.status], p.refId, p.note]),
        ])}><Download className="size-4" /> CSV</Button>
      }>
        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={cn(smallField, "w-auto")}>
            <option value="all">All statuses</option>{Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={cn(smallField, "w-auto")}>
            <option value="all">All methods</option>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="ms-auto text-sm">Total paid: <b>{money(total)}</b></span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>{["Date", "Venue", "Period", "Amount", "Method", "Status", "Reference / note"].map((h) => <th key={h} className="p-2.5 text-start font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2.5 text-muted-foreground">{fmtDateTime(p.createdAt)}</td>
                  <td className="p-2.5">{p.tenantName}</td>
                  <td className="p-2.5">{num(p.months)} mo</td>
                  <td className="p-2.5">{p.amount ? money(p.amount) : "—"}{p.coupon && <span className="block text-[11px] text-muted-foreground">code {p.coupon}</span>}</td>
                  <td className="p-2.5">{METHOD[p.method] || p.method}</td>
                  <td className={cn("p-2.5 font-semibold", p.status === "paid" ? "text-green-700 dark:text-green-400" : p.status === "pending" ? "text-amber-700" : "text-primary")}>{PAY[p.status]}</td>
                  <td className="p-2.5 text-xs text-muted-foreground">{p.refId ? <span>{p.refId}</span> : p.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}

/* ============================ Settings ============================ */
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "JPY", "SGD", "HKD", "INR", "AED", "SAR", "TRY", "ZAR", "BRL", "MXN"];

function PlatformSettingsForm({ initial, root, reload, flash }: { initial: PlatformSettings; root: string; reload: () => void; flash: Flash }) {
  const [s, setS] = useState<PlatformSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [newPw, setNewPw] = useState("");
  const set = (p: Partial<PlatformSettings>) => setS((x) => ({ ...x, ...p }));
  const setSms = (p: Partial<PlatformSettings["sms"]>) => setS((x) => ({ ...x, sms: { ...x.sms, ...p } }));
  const save = async () => {
    setBusy(true);
    try { unwrap(await adminSaveSettingsAction(s)); flash("✅ Settings saved"); reload(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  };
  const currency = (s.currency || "USD").toUpperCase();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box title="Signup & free trial">
        <p className="text-xs text-muted-foreground">The name, logo, colors and all website texts are edited under “Site content”.</p>
        <L t="Free trial days"><input type="number" min={0} max={90} value={s.trialDays} onChange={(e) => set({ trialDays: Number(e.target.value) })} className={fieldCls} /></L>
        <Toggle checked={s.allowSignup} onChange={(v) => set({ allowSignup: v })} label="Online signup is open" />
        <L t="Currency" hint="3-letter ISO code used for plan prices and payments">
          <input value={s.currency} list="pf-currencies" maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} placeholder="USD" className={cn(fieldCls, "uppercase")} />
          <datalist id="pf-currencies">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
        </L>
      </Box>

      <Box title={`Subscription plans (${currency})`}>
        {s.plans.map((p, i) => (
          // On phones: title on the first row, the rest on the second
          <div key={i} className="grid grid-cols-[4.5rem_1fr_auto_auto] items-center gap-1.5 rounded-2xl border border-border p-2 sm:grid-cols-[1fr_4.5rem_7rem_auto_auto] sm:rounded-none sm:border-0 sm:p-0">
            <input value={p.title} onChange={(e) => set({ plans: s.plans.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" className={cn(fieldCls, "col-span-4 px-3 py-2 sm:col-span-1")} />
            <input type="number" min={1} value={p.months} onChange={(e) => set({ plans: s.plans.map((x, j) => (j === i ? { ...x, months: Number(e.target.value) } : x)) })} title="Months" aria-label="Duration (months)" className={cn(fieldCls, "px-2 py-2")} />
            <input type="number" inputMode="decimal" min={0} step="0.01" value={p.price} onChange={(e) => set({ plans: s.plans.map((x, j) => (j === i ? { ...x, price: parsePrice(e.target.value) } : x)) })} title="Price" aria-label={`Price (${currency})`} className={cn(fieldCls, "px-2 py-2")} />
            <label title="Most popular" className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-primary" checked={!!p.popular} onChange={(e) => set({ plans: s.plans.map((x, j) => ({ ...x, popular: j === i ? e.target.checked : false })) })} />⭐</label>
            <button aria-label="Remove" onClick={() => set({ plans: s.plans.filter((_, j) => j !== i) })} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">Columns: title · duration (months) · price ({currency}) · most popular</p>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => set({ plans: [...s.plans, { id: `p${Date.now().toString(36)}`, title: "", months: 1, price: 0 }] })}><Plus className="size-4" /> Add plan</Button>
      </Box>

      <Box title="Online payments (Stripe)">
        <L t="Stripe secret key" hint={<>Empty = online payment disabled. Create a key at <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener" className="font-semibold text-primary underline-offset-2 hover:underline">dashboard.stripe.com/apikeys</a>. A masked value (••••1234) means the current key is kept.</>}>
          <input type="password" value={s.stripe.secretKey} onChange={(e) => set({ stripe: { secretKey: e.target.value.trim() } })} placeholder="sk_live_…" autoComplete="off" className={fieldCls} />
        </L>
        <p className="rounded-2xl bg-muted/50 p-3 text-[11px] leading-5 text-muted-foreground">
          Optional webhook (confirms payments even if the customer closes the tab): in Stripe → Developers → Webhooks, add
          <b className="mx-1 select-all break-all text-foreground">{`https://${root}/stripe/webhook`}</b>
          with the event <b className="text-foreground">checkout.session.completed</b>.
        </p>
      </Box>

      <Box title="Bank transfer">
        <L t="Account / IBAN" hint="Empty = bank transfer disabled. Venues upload a receipt that you approve under Payments."><input value={s.card.number} onChange={(e) => set({ card: { ...s.card, number: e.target.value } })} className={fieldCls} /></L>
        <div className="grid grid-cols-2 gap-2">
          <L t="Account holder"><input value={s.card.holder} onChange={(e) => set({ card: { ...s.card, holder: e.target.value } })} className={fieldCls} /></L>
          <L t="Bank name"><input value={s.card.bank} onChange={(e) => set({ card: { ...s.card, bank: e.target.value } })} className={fieldCls} /></L>
        </div>
      </Box>

      <Box title="Platform SMS (Twilio) — signup codes, reminders, SMS to owners" className="lg:col-span-2">
        <select value={s.sms.provider} onChange={(e) => setSms({ provider: e.target.value as PlatformSettings["sms"]["provider"] })} className={fieldCls}>
          <option value="none">None (signup without phone verification)</option>
          <option value="twilio">Twilio</option>
        </select>
        {s.sms.provider === "twilio" && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <L t="Account SID"><input value={s.sms.accountSid} onChange={(e) => setSms({ accountSid: e.target.value.trim() })} placeholder="AC…" autoComplete="off" className={fieldCls} /></L>
              <L t="Auth Token" hint="Leave as is to keep the current token"><input type="password" value={s.sms.authToken} onChange={(e) => setSms({ authToken: e.target.value.trim() })} autoComplete="off" className={fieldCls} /></L>
              <L t="Sender" hint="Twilio number (+15551234567), sender ID or Messaging Service SID (MG…)"><input value={s.sms.from} onChange={(e) => setSms({ from: e.target.value.trim() })} placeholder="+15551234567" className={fieldCls} /></L>
            </div>
            <p className="text-[11px] text-muted-foreground">Find your Account SID and Auth Token in the <a href="https://console.twilio.com" target="_blank" rel="noopener" className="font-semibold text-primary underline-offset-2 hover:underline">Twilio Console</a>.</p>
            <div className="flex gap-2">
              <input type="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+1 555 123 4567" className={fieldCls} />
              <Button variant="outline" className="h-auto shrink-0 rounded-xl" disabled={!testPhone.trim()} onClick={async () => {
                try { await adminSaveSettingsAction(s).then(unwrap); flash("✅ " + unwrap(await adminTestSmsAction(testPhone)).detail); } catch (e) { flash("❌ " + err(e)); }
              }}>Send test SMS</Button>
            </div>
          </>
        )}
      </Box>

      <div className="lg:col-span-2">
        <Button size="lg" className="h-12 w-full rounded-2xl" disabled={busy} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <><Settings className="size-5" /> Save settings</>}</Button>
      </div>

      <Box title="Admin password">
        <div className="flex gap-2">
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min. 8 characters)" className={fieldCls} autoComplete="new-password" />
          <Button variant="outline" className="h-auto shrink-0 rounded-xl" disabled={newPw.length < 8} onClick={async () => {
            try { unwrap(await adminSetPasswordAction(newPw)); setNewPw(""); flash("✅ Password changed"); } catch (e) { flash("❌ " + err(e)); }
          }}>Change</Button>
        </div>
      </Box>
    </div>
  );
}
