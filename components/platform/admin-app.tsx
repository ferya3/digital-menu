"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban, CalendarPlus, Check, CircleDollarSign, ExternalLink, Globe, KeyRound, Loader2, LogIn, LogOut, Plus, Receipt,
  Search, Settings, Store, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDate, faDateTime, money, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import {
  adminCreateTenantAction, adminDataAction, adminDeleteTenantAction, adminEnterAction, adminExtendAction, adminLoginAction,
  adminLogoutAction, adminPaymentAction, adminResetPasswordAction, adminSaveSettingsAction, adminSetPasswordAction,
  adminStatusAction, adminTestSmsAction, adminUpdateTenantAction, type AdminData, type AdminTenant,
} from "@/app/platform/actions";
import { KIND_LABEL, type BusinessKind } from "@/lib/seeds";
import type { PlatformSettings } from "@/lib/platform";
import { fieldCls } from "@/components/platform/signup-form";

const err = (e: unknown) => (e instanceof Error ? e.message : "خطا");
const STATE: Record<string, { label: string; cls: string }> = {
  trial: { label: "آزمایشی", cls: "bg-blue-600/10 text-blue-700 dark:text-blue-400" },
  active: { label: "فعال", cls: "bg-green-600/10 text-green-700 dark:text-green-400" },
  expired: { label: "منقضی", cls: "bg-primary/10 text-primary" },
  suspended: { label: "تعلیق", cls: "bg-muted text-muted-foreground" },
};
const PAY: Record<string, string> = { pending: "در انتظار", paid: "پرداخت‌شده", failed: "ناموفق", rejected: "ردشده" };
const METHOD: Record<string, string> = { zarinpal: "زرین‌پال", card: "کارت‌به‌کارت", manual: "دستی" };

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
        <h1 className="mt-3 text-center text-xl font-black">مدیریتِ پلتفرم</h1>
        {!configured && <p className="mt-3 rounded-2xl bg-amber-500/15 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300">رمزِ مدیرِ کل روی سرور تنظیم نشده است (PLATFORM_ADMIN_PASSWORD در set-saas.sh).</p>}
        <input type="password" autoFocus value={pw} onChange={(x) => setPw(x.target.value)} placeholder="رمزِ مدیرِ کل" className={cn(fieldCls, "mt-5")} />
        {e && <p className="mt-2 text-sm font-semibold text-primary">{e}</p>}
        <Button type="submit" className="mt-4 h-11 w-full rounded-2xl" disabled={busy || !pw}>{busy ? <Loader2 className="animate-spin" /> : "ورود"}</Button>
      </form>
    </main>
  );
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<"tenants" | "payments" | "settings">("tenants");
  const [toast, setToast] = useState("");
  const flash = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast(""), 4000); }, []);
  const load = useCallback(() => {
    adminDataAction().then((r) => setData(unwrap(r))).catch((e) => { if (/وارد شوید/.test(err(e))) onLogout(); else flash("❌ " + err(e)); });
  }, [flash, onLogout]);
  useEffect(load, [load]);

  const pending = data?.payments.filter((p) => p.status === "pending" && p.method === "card").length || 0;
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Store className="size-5" /></span>
          <b className="hidden sm:block">مدیریتِ پلتفرم</b>
          <nav className="ms-auto flex rounded-full bg-muted p-1 text-sm font-semibold">
            {([["tenants", "مجموعه‌ها"], ["payments", "پرداخت‌ها"], ["settings", "تنظیمات"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => setTab(id)} className={cn("relative rounded-full px-3 py-1.5 transition sm:px-4", tab === id ? "bg-card shadow" : "text-muted-foreground")}>
                {l}
                {id === "payments" && pending > 0 && <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{toFa(pending)}</span>}
              </button>
            ))}
          </nav>
          <Button variant="ghost" size="icon" aria-label="خروج" onClick={async () => { await adminLogoutAction(); onLogout(); }}><LogOut /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        {!data ? <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
          : tab === "tenants" ? <Tenants data={data} reload={load} flash={flash} />
          : tab === "payments" ? <Payments data={data} reload={load} flash={flash} />
          : <PlatformSettingsForm initial={data.settings} reload={load} flash={flash} />}
      </main>
      {toast && <div className="fixed inset-x-0 top-3 z-[80] mx-auto w-fit max-w-[92vw] rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background shadow-lg">{toast}</div>}
    </div>
  );
}

type Tools = { data: AdminData; reload: () => void; flash: (t: string) => void };

/* ============================ مجموعه‌ها ============================ */
function Tenants({ data, reload, flash }: Tools) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "trial" | "active" | "expired" | "suspended">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => data.tenants.filter((t) =>
    (filter === "all" || t.state === filter) &&
    (!q || [t.name, t.slug, t.ownerPhone, t.ownerName, t.domain].some((x) => x.toLowerCase().includes(q.toLowerCase())))
  ), [data.tenants, q, filter]);
  const monthStart = new Date(); monthStart.setDate(monthStart.getDate() - 30);
  const revenue = data.payments.filter((p) => p.status === "paid" && new Date(p.paidAt) >= monthStart).reduce((s, p) => s + p.amount, 0);
  const count = (s: string) => data.tenants.filter((t) => t.state === s).length;
  const sel = data.tenants.find((t) => t.slug === open);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["کلِ مجموعه‌ها", toFa(data.tenants.length)], ["فعال", toFa(count("active"))], ["آزمایشی", toFa(count("trial"))],
          ["منقضی / تعلیق", toFa(count("expired") + count("suspended"))], ["درآمد ۳۰ روز", money(revenue)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-3xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><b className="mt-1 block text-lg">{v}</b></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: نام، آدرس، موبایل…" className={cn(fieldCls, "py-2.5 pr-9")} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={cn(fieldCls, "w-auto py-2.5")}>
          <option value="all">همه</option><option value="active">فعال</option><option value="trial">آزمایشی</option><option value="expired">منقضی</option><option value="suspended">تعلیق</option>
        </select>
        <Button className="rounded-2xl" onClick={() => setCreating(true)}><Plus className="size-4" /> مجموعهٔ جدید</Button>
      </div>

      {list.length === 0 ? <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">مجموعه‌ای نیست</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <button key={t.slug} onClick={() => setOpen(t.slug)} className="rounded-3xl border border-border bg-card p-4 text-right shadow-sm transition hover:border-primary/40">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{t.name}</b>
                  <span className="block truncate text-xs text-muted-foreground" dir="ltr">{t.domain || `${t.slug}.${data.root}`}</span>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", STATE[t.state].cls)}>{STATE[t.state].label}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{KIND_LABEL[t.kind]?.split(" ")[0]}</span>
                {t.ownerPhone && <span dir="ltr">{toFa(t.ownerPhone)}</span>}
                <span>{t.expiresAt.startsWith("2099") ? "بدونِ انقضا" : t.daysLeft > 0 ? `${toFa(t.daysLeft)} روز مانده` : `انقضا: ${faDate(t.expiresAt)}`}</span>
                <span>{toFa(t.stats.orders)} سفارش</span>
                <span>{toFa(t.stats.items)} محصول</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {sel && <TenantDrawer t={sel} data={data} onClose={() => setOpen(null)} reload={reload} flash={flash} />}
      {creating && <CreateTenant root={data.root} trial={data.settings.trialDays} onClose={() => setCreating(false)} reload={reload} flash={flash} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} aria-label="بستن" className="grid size-9 place-items-center rounded-full bg-muted"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TenantDrawer({ t, data, onClose, reload, flash }: { t: AdminTenant; onClose: () => void } & Tools) {
  const [busy, setBusy] = useState("");
  const [domain, setDomain] = useState(t.domain);
  const [note, setNote] = useState(t.note);
  const [until, setUntil] = useState("");
  const [pw, setPw] = useState("");
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) flash(ok); reload(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(""); }
  };
  const extend = (o: { months?: number; days?: number; until?: string }, label: string) =>
    run("ext", async () => unwrap(await adminExtendAction(t.slug, o)), `✅ ${label}`);
  const payments = data.payments.filter((p) => p.slug === t.slug).slice(0, 8);

  return (
    <Modal title={t.name} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATE[t.state].cls)}>{STATE[t.state].label}</span>
        <a href={t.url} target="_blank" rel="noopener" className="flex items-center gap-1 font-semibold text-primary" dir="ltr">{t.domain || `${t.slug}.${data.root}`} <ExternalLink className="size-3.5" /></a>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-muted/50 p-3 text-sm">
        <dt className="text-muted-foreground">صاحب</dt><dd>{t.ownerName || "—"} <span dir="ltr">{t.ownerPhone ? toFa(t.ownerPhone) : ""}</span></dd>
        <dt className="text-muted-foreground">نوع</dt><dd>{KIND_LABEL[t.kind]}</dd>
        <dt className="text-muted-foreground">ثبت‌نام</dt><dd>{faDate(t.createdAt)}</dd>
        <dt className="text-muted-foreground">اعتبار تا</dt><dd>{t.expiresAt.startsWith("2099") ? "بدونِ انقضا" : `${faDate(t.expiresAt)} (${t.daysLeft > 0 ? `${toFa(t.daysLeft)} روز` : "تمام‌شده"})`}</dd>
        <dt className="text-muted-foreground">آخرین فعالیت</dt><dd>{t.lastSeen ? faDateTime(t.lastSeen) : "—"}</dd>
        <dt className="text-muted-foreground">آمار</dt><dd>{toFa(t.stats.orders)} سفارش · {toFa(t.stats.customers)} مشتری · فروشِ ۳۰ روز {money(t.stats.revenue30)}</dd>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button className="rounded-xl" disabled={!!busy} onClick={() => run("enter", async () => { const r = unwrap(await adminEnterAction(t.slug)); window.open(r.url, "_blank"); })}>
          {busy === "enter" ? <Loader2 className="animate-spin" /> : <><LogIn className="size-4" /> ورود به پنل</>}
        </Button>
        <Button variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => run("pw", async () => setPw(unwrap(await adminResetPasswordAction(t.slug)).password))}>
          <KeyRound className="size-4" /> رمزِ جدید
        </Button>
      </div>
      {pw && <p className="mt-2 rounded-2xl bg-green-600/10 p-3 text-center text-sm">رمزِ جدیدِ پنل: <b dir="ltr" className="select-all text-base">{pw}</b><br /><span className="text-xs text-muted-foreground">به صاحبِ مجموعه بدهید؛ دوباره نمایش داده نمی‌شود.</span></p>}

      <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-extrabold"><CalendarPlus className="size-4 text-primary" /> تمدید / تغییرِ اعتبار</h3>
      <div className="flex flex-wrap gap-2">
        {[[1, "۱ ماه"], [3, "۳ ماه"], [6, "۶ ماه"], [12, "۱ سال"]].map(([m, l]) => (
          <Button key={m} size="sm" variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => extend({ months: Number(m) }, `${l} تمدید شد`)}>+{l}</Button>
        ))}
        <Button size="sm" variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => extend({ days: 7 }, "۷ روز اضافه شد")}>+۷ روز</Button>
      </div>
      <div className="mt-2 flex gap-2">
        <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={cn(fieldCls, "py-2")} />
        <Button size="sm" variant="outline" className="h-auto shrink-0 rounded-xl" disabled={!until || !!busy} onClick={() => extend({ until }, "تاریخ تنظیم شد")}>تعیینِ تاریخ</Button>
      </div>

      <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-extrabold"><Globe className="size-4 text-primary" /> دامنهٔ اختصاصی (اختیاری)</h3>
      <div className="flex gap-2">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="menu.example.ir" dir="ltr" className={cn(fieldCls, "py-2")} />
        <Button size="sm" variant="outline" className="h-auto shrink-0 rounded-xl" disabled={!!busy || domain === t.domain}
          onClick={() => run("dom", async () => unwrap(await adminUpdateTenantAction(t.slug, { domain })), "✅ دامنه ذخیره شد")}>ذخیره</Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">رکوردِ A این دامنه باید به IPِ همین سرور اشاره کند؛ گواهیِ HTTPS خودکار گرفته می‌شود.</p>

      <h3 className="mb-2 mt-5 font-extrabold">یادداشتِ داخلی</h3>
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={cn(fieldCls, "py-2")} />
        <Button size="sm" variant="outline" className="h-auto shrink-0 rounded-xl" disabled={!!busy || note === t.note}
          onClick={() => run("note", async () => unwrap(await adminUpdateTenantAction(t.slug, { note })), "✅ ذخیره شد")}>ذخیره</Button>
      </div>

      {payments.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 font-extrabold">پرداخت‌ها</h3>
          <div className="space-y-1 text-xs">
            {payments.map((p) => <div key={p.id} className="flex justify-between rounded-xl bg-muted/50 px-3 py-2"><span>{faDate(p.createdAt)} · {toFa(p.months)} ماه · {METHOD[p.method]}</span><span>{p.amount ? money(p.amount) : "—"} · {PAY[p.status]}</span></div>)}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" className="rounded-xl" disabled={!!busy}
          onClick={() => run("sus", async () => unwrap(await adminUpdateTenantAction(t.slug, { status: t.status === "suspended" ? "active" : "suspended" })), t.status === "suspended" ? "✅ فعال شد" : "مجموعه تعلیق شد")}>
          {t.status === "suspended" ? <><Check className="size-4" /> رفعِ تعلیق</> : <><Ban className="size-4" /> تعلیق</>}
        </Button>
        <Button variant="ghost" className="rounded-xl text-primary" disabled={!!busy}
          onClick={() => {
            const c = prompt(`برای حذفِ «${t.name}»، آدرسِ آن (${t.slug}) را تایپ کنید.\nداده‌ها به پوشهٔ data/deleted منتقل می‌شوند.`);
            if (c) run("del", async () => { unwrap(await adminDeleteTenantAction(t.slug, c.trim())); onClose(); }, "مجموعه حذف شد");
          }}>
          <Trash2 className="size-4" /> حذف
        </Button>
      </div>
    </Modal>
  );
}

function CreateTenant({ root, trial, onClose, reload, flash }: { root: string; trial: number; onClose: () => void; reload: () => void; flash: (t: string) => void }) {
  const [f, setF] = useState({ name: "", slug: "", kind: "cafe" as BusinessKind, ownerName: "", phone: "", password: "", months: 0, sample: true });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Modal title="مجموعهٔ جدید" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { unwrap(await adminCreateTenantAction(f)); flash(`✅ ${f.name} ساخته شد`); reload(); onClose(); } catch (x) { flash("❌ " + err(x)); } finally { setBusy(false); }
      }}>
        <input required value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="نامِ مجموعه" className={fieldCls} />
        <div dir="ltr" className="flex items-center overflow-hidden rounded-2xl border border-border">
          <input required value={f.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="address" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none" />
          <span className="bg-muted px-3 py-3 text-sm text-muted-foreground">.{root}</span>
        </div>
        <select value={f.kind} onChange={(e) => set({ kind: e.target.value as BusinessKind })} className={fieldCls}>
          {(Object.keys(KIND_LABEL) as BusinessKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input value={f.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder="نامِ صاحب" className={fieldCls} />
          <input value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="موبایل" dir="ltr" className={fieldCls} />
        </div>
        <input required minLength={6} value={f.password} onChange={(e) => set({ password: e.target.value })} placeholder="رمزِ پنلِ مجموعه (حداقل ۶ نویسه)" dir="ltr" className={fieldCls} />
        <select value={f.months} onChange={(e) => set({ months: Number(e.target.value) })} className={fieldCls}>
          <option value={0}>دورهٔ آزمایشی ({toFa(trial)} روز)</option>
          {[1, 3, 6, 12].map((m) => <option key={m} value={m}>اشتراکِ {toFa(m)} ماهه (پرداختِ حضوری)</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.sample} onChange={(e) => set({ sample: e.target.checked })} /> منوی نمونه</label>
        <Button type="submit" className="h-11 w-full rounded-2xl" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "ساختن"}</Button>
      </form>
    </Modal>
  );
}

/* ============================ پرداخت‌ها ============================ */
function Payments({ data, reload, flash }: Tools) {
  const [busy, setBusy] = useState("");
  const decide = async (id: string, approve: boolean) => {
    let note = "";
    if (!approve) { const r = prompt("دلیلِ رد (به مجموعه نمایش داده می‌شود):", "مبلغ واریزی پیدا نشد"); if (r === null) return; note = r; }
    setBusy(id);
    try { unwrap(await adminPaymentAction(id, approve, note)); flash(approve ? "✅ تأیید شد و اشتراک تمدید شد" : "رد شد"); reload(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(""); }
  };
  const pending = data.payments.filter((p) => p.status === "pending" && p.method === "card");
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-extrabold"><Receipt className="size-5 text-primary" /> فیش‌های در انتظارِ بررسی</h2>
        {pending.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">فیشی در انتظار نیست</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-2xl border border-border p-3">
                {p.receiptUrl && (
                  <a href={p.receiptUrl} target="_blank" rel="noopener" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.receiptUrl} alt="فیش" className="h-28 w-20 rounded-xl object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <b className="block">{p.tenantName}</b>
                  <span className="block text-xs text-muted-foreground">{faDateTime(p.createdAt)}</span>
                  <span className="mt-1 block">{toFa(p.months)} ماه · <b>{money(p.amount)}</b></span>
                  {p.note && <span className="block text-xs text-muted-foreground">«{p.note}»</span>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-8 rounded-xl" disabled={!!busy} onClick={() => decide(p.id, true)}>{busy === p.id ? <Loader2 className="animate-spin" /> : <><Check className="size-4" /> تأیید</>}</Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={!!busy} onClick={() => decide(p.id, false)}>رد</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-3xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-extrabold"><CircleDollarSign className="size-5 text-primary" /> همهٔ پرداخت‌ها</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>{["تاریخ", "مجموعه", "مدت", "مبلغ", "روش", "وضعیت", "پیگیری / توضیح"].map((h) => <th key={h} className="p-2.5 text-right font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2.5 text-muted-foreground">{faDateTime(p.createdAt)}</td>
                  <td className="p-2.5">{p.tenantName}</td>
                  <td className="p-2.5">{toFa(p.months)} ماه</td>
                  <td className="p-2.5">{p.amount ? money(p.amount) : "—"}</td>
                  <td className="p-2.5">{METHOD[p.method]}</td>
                  <td className={cn("p-2.5 font-semibold", p.status === "paid" ? "text-green-700 dark:text-green-400" : p.status === "pending" ? "text-amber-700" : "text-primary")}>{PAY[p.status]}</td>
                  <td className="p-2.5 text-xs text-muted-foreground">{p.refId ? <span dir="ltr">{p.refId}</span> : p.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ============================ تنظیمات ============================ */
// بیرون از کامپوننت تعریف شده‌اند تا با هر تایپ دوباره ساخته نشوند (فوکوسِ ورودی‌ها حفظ شود)
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-border bg-card p-4"><h2 className="mb-3 font-extrabold">{title}</h2><div className="space-y-3">{children}</div></section>;
}
function L({ t, children, hint }: { t: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">{t}</span>{children}{hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}
function PlatformSettingsForm({ initial, reload, flash }: { initial: PlatformSettings; reload: () => void; flash: (t: string) => void }) {
  const [s, setS] = useState<PlatformSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [newPw, setNewPw] = useState("");
  const set = (p: Partial<PlatformSettings>) => setS((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try { unwrap(await adminSaveSettingsAction(s)); flash("✅ تنظیمات ذخیره شد"); reload(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box title="معرفیِ پلتفرم">
        <L t="نامِ برند"><input value={s.brand} onChange={(e) => set({ brand: e.target.value })} className={fieldCls} /></L>
        <L t="شعار"><input value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} className={fieldCls} /></L>
        <L t="تلفنِ پشتیبانی"><input value={s.support} onChange={(e) => set({ support: e.target.value })} dir="ltr" className={fieldCls} /></L>
        <div className="grid grid-cols-2 gap-2">
          <L t="روزهای آزمایشیِ رایگان"><input type="number" min={0} max={90} value={s.trialDays} onChange={(e) => set({ trialDays: Number(e.target.value) })} className={fieldCls} /></L>
          <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={s.allowSignup} onChange={(e) => set({ allowSignup: e.target.checked })} /> ثبت‌نامِ آنلاین باز است</label>
        </div>
      </Box>

      <Box title="طرح‌های اشتراک (تومان)">
        {s.plans.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_auto_auto] items-center gap-1.5">
            <input value={p.title} onChange={(e) => set({ plans: s.plans.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="عنوان" className={cn(fieldCls, "px-3 py-2")} />
            <input type="number" min={1} value={p.months} onChange={(e) => set({ plans: s.plans.map((x, j) => (j === i ? { ...x, months: Number(e.target.value) } : x)) })} title="ماه" className={cn(fieldCls, "px-2 py-2")} />
            <input type="number" min={0} step={1000} value={p.price} onChange={(e) => set({ plans: s.plans.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)) })} title="قیمت" className={cn(fieldCls, "px-2 py-2")} />
            <label title="پیشنهادی" className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-primary" checked={!!p.popular} onChange={(e) => set({ plans: s.plans.map((x, j) => ({ ...x, popular: j === i ? e.target.checked : false })) })} />⭐</label>
            <button aria-label="حذف" onClick={() => set({ plans: s.plans.filter((_, j) => j !== i) })} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">ستون‌ها: عنوان · مدت (ماه) · قیمت (تومان) · پیشنهادی</p>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => set({ plans: [...s.plans, { id: `p${Date.now().toString(36)}`, title: "", months: 1, price: 0 }] })}><Plus className="size-4" /> طرحِ جدید</Button>
      </Box>

      <Box title="دریافتِ حق‌اشتراک">
        <L t="مرچنت‌کدِ زرین‌پال" hint="خالی = پرداختِ آنلاین غیرفعال"><input value={s.zarinpal.merchant} onChange={(e) => set({ zarinpal: { ...s.zarinpal, merchant: e.target.value.trim() } })} dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={fieldCls} /></L>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={s.zarinpal.sandbox} onChange={(e) => set({ zarinpal: { ...s.zarinpal, sandbox: e.target.checked } })} /> حالتِ آزمایشیِ زرین‌پال (sandbox)</label>
        <L t="کارت‌به‌کارت — شمارهٔ کارت" hint="خالی = کارت‌به‌کارت غیرفعال"><input value={s.card.number} onChange={(e) => set({ card: { ...s.card, number: e.target.value } })} dir="ltr" className={fieldCls} /></L>
        <div className="grid grid-cols-2 gap-2">
          <L t="به نامِ"><input value={s.card.holder} onChange={(e) => set({ card: { ...s.card, holder: e.target.value } })} className={fieldCls} /></L>
          <L t="بانک"><input value={s.card.bank} onChange={(e) => set({ card: { ...s.card, bank: e.target.value } })} className={fieldCls} /></L>
        </div>
      </Box>

      <Box title="پیامکِ پلتفرم (کدِ تأییدِ ثبت‌نام)">
        <select value={s.sms.provider} onChange={(e) => set({ sms: { ...s.sms, provider: e.target.value as PlatformSettings["sms"]["provider"] } })} className={fieldCls}>
          <option value="none">بدونِ پیامک (ثبت‌نام بدونِ تأییدِ موبایل)</option>
          <option value="wide">وایدی / عصر فرا ارتباط (wide.ir)</option>
          <option value="kavenegar">کاوه‌نگار</option>
        </select>
        {s.sms.provider === "wide" && (
          <div className="grid grid-cols-2 gap-2">
            <input value={s.sms.username} onChange={(e) => set({ sms: { ...s.sms, username: e.target.value } })} placeholder="نام کاربری" dir="ltr" className={fieldCls} />
            <input type="password" value={s.sms.password} onChange={(e) => set({ sms: { ...s.sms, password: e.target.value } })} placeholder="رمز" dir="ltr" className={fieldCls} />
            <input value={s.sms.sender} onChange={(e) => set({ sms: { ...s.sms, sender: e.target.value } })} placeholder="شمارهٔ خط" dir="ltr" className={fieldCls} />
            <input value={s.sms.domain || ""} onChange={(e) => set({ sms: { ...s.sms, domain: e.target.value } })} placeholder="wide.ir" dir="ltr" className={fieldCls} />
          </div>
        )}
        {s.sms.provider === "kavenegar" && (
          <div className="grid grid-cols-2 gap-2">
            <input value={s.sms.apiKey} onChange={(e) => set({ sms: { ...s.sms, apiKey: e.target.value } })} placeholder="API Key" dir="ltr" className={fieldCls} />
            <input value={s.sms.sender} onChange={(e) => set({ sms: { ...s.sms, sender: e.target.value } })} placeholder="شمارهٔ خط (اختیاری)" dir="ltr" className={fieldCls} />
          </div>
        )}
        {s.sms.provider !== "none" && (
          <div className="flex gap-2">
            <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="09…" dir="ltr" className={fieldCls} />
            <Button variant="outline" className="h-auto shrink-0 rounded-xl" onClick={async () => {
              try { await adminSaveSettingsAction(s).then(unwrap); flash("✅ " + unwrap(await adminTestSmsAction(testPhone)).detail); } catch (e) { flash("❌ " + err(e)); }
            }}>ارسالِ آزمایشی</Button>
          </div>
        )}
      </Box>

      <div className="lg:col-span-2">
        <Button size="lg" className="h-12 w-full rounded-2xl" disabled={busy} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <><Settings className="size-5" /> ذخیرهٔ تنظیمات</>}</Button>
      </div>

      <Box title="رمزِ مدیرِ کل">
        <div className="flex gap-2">
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="رمزِ جدید (حداقل ۸ نویسه)" className={fieldCls} autoComplete="new-password" />
          <Button variant="outline" className="h-auto shrink-0 rounded-xl" disabled={newPw.length < 8} onClick={async () => {
            try { unwrap(await adminSetPasswordAction(newPw)); setNewPw(""); flash("✅ رمز عوض شد"); } catch (e) { flash("❌ " + err(e)); }
          }}>تغییر</Button>
        </div>
      </Box>
    </div>
  );
}
