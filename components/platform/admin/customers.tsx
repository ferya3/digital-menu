"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminCustomersAction, adminCustomersExportAction } from "@/app/platform/actions";
import type { PlatformCustomer } from "@/lib/platform-admin";
import { Box, downloadCsv, err, smallField, type Flash } from "./shared";

const PAGE = 200;

/** شماره‌هایی که مشتریانِ هر مجموعه در منوی آن مجموعه ثبت (با کدِ پیامکی تأیید) کرده‌اند */
export function PlatformCustomers({ flash, initialSlug }: { flash: Flash; initialSlug: string }) {
  const [data, setData] = useState<{ rows: PlatformCustomer[]; perTenant: { slug: string; name: string; count: number }[] } | null>(null);
  const [slug, setSlug] = useState(initialSlug);
  const [q, setQ] = useState("");
  const [sms, setSms] = useState<"all" | "ok" | "out">("all");
  const [minVisits, setMinVisits] = useState(1);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => { adminCustomersAction().then((r) => setData(unwrap(r))).catch((e) => flash("❌ " + err(e))); }, [flash]);
  useEffect(() => setSlug(initialSlug), [initialSlug]);

  const list = useMemo(() => {
    if (!data) return [];
    const d = q.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/\D/g, "");
    return data.rows.filter((r) => (!slug || r.slug === slug) && (!d || r.phone.includes(d)) && r.visits >= minVisits
      && (sms === "all" || (sms === "out" ? r.optOut : !r.optOut)));
  }, [data, slug, q, sms, minVisits]);
  useEffect(() => setShown(PAGE), [slug, q, sms, minVisits]);

  if (!data) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  const unique = new Set(list.map((r) => r.phone)).size;
  const allUnique = new Set(data.rows.map((r) => r.phone)).size;
  const label = slug ? data.perTenant.find((t) => t.slug === slug)?.name || slug : "همهٔ مجموعه‌ها";

  async function exportCsv() {
    downloadCsv(`customers-${slug || "all"}.csv`, [
      ["شماره موبایل", "مجموعه", "آدرس مجموعه", "دفعات", "میزها", "اولین بازدید", "آخرین بازدید", "پیامک تبلیغاتی"],
      ...list.map((r) => [r.phone, r.tenant, r.slug, r.visits, r.tables.split(",").filter(Boolean).join(" | "), r.firstSeen, r.lastSeen, r.optOut ? "لغو کرده" : "فعال"]),
    ]);
    await adminCustomersExportAction(slug, list.length).catch(() => {});
  }
  async function copyNumbers() {
    const nums = [...new Set(list.map((r) => r.phone))].join("\n");
    try { await navigator.clipboard.writeText(nums); flash(`✅ ${toFa(unique)} شماره کپی شد`); } catch { flash("کپی انجام نشد"); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["کلِ شماره‌ها", data.rows.length], ["شماره‌های یکتا", allUnique], ["مجموعه‌های دارای مشتری", data.perTenant.filter((t) => t.count).length], ["در فیلترِ فعلی", list.length]].map(([k, v]) => (
          <div key={String(k)} className="rounded-3xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><b className="mt-1 block text-lg">{toFa(Number(v))}</b></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <Box title={`شماره‌های مشتریان — ${label}`} action={
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="rounded-xl" disabled={!list.length} onClick={copyNumbers}><Copy className="size-4" /> کپیِ شماره‌ها</Button>
            <Button size="sm" variant="outline" className="rounded-xl" disabled={!list.length} onClick={exportCsv}><Download className="size-4" /> اکسل</Button>
          </div>
        }>
          <div className="flex flex-wrap gap-2">
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className={cn(smallField, "w-auto")}>
              <option value="">همهٔ مجموعه‌ها ({toFa(data.rows.length)})</option>
              {data.perTenant.map((t) => <option key={t.slug} value={t.slug}>{t.name} ({toFa(t.count)})</option>)}
            </select>
            <div className="relative min-w-40 flex-1">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی شماره" className={cn(smallField, "pr-9")} />
            </div>
            <select value={sms} onChange={(e) => setSms(e.target.value as typeof sms)} className={cn(smallField, "w-auto")}>
              <option value="all">همه</option><option value="ok">پیامکِ تبلیغاتی فعال</option><option value="out">لغو کرده‌ها</option>
            </select>
            <select value={minVisits} onChange={(e) => setMinVisits(Number(e.target.value))} className={cn(smallField, "w-auto")}>
              {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n === 1 ? "همهٔ دفعات" : `${toFa(n)} بار یا بیشتر`}</option>)}
            </select>
          </div>
          {list.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">شماره‌ای نیست — شماره‌ها وقتی جمع می‌شوند که مجموعه «تأیید شمارهٔ مشتری» را در تنظیماتش روشن کرده باشد.</p> : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["#", "شماره موبایل", "مجموعه", "دفعات", "آخرین بازدید", "پیامک تبلیغاتی"].map((h) => <th key={h} className="p-2.5 text-right font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {list.slice(0, shown).map((r, i) => (
                      <tr key={r.slug + r.phone} className="border-t border-border">
                        <td className="p-2.5 text-muted-foreground">{toFa(i + 1)}</td>
                        <td className="p-2.5 font-bold" dir="ltr" style={{ textAlign: "right" }}>{toFa(r.phone)}</td>
                        <td className="p-2.5"><button onClick={() => setSlug(r.slug)} className="hover:text-primary">{r.tenant}</button></td>
                        <td className="p-2.5">{toFa(r.visits)}</td>
                        <td className="p-2.5 text-xs text-muted-foreground">{r.lastSeen ? faDateTime(r.lastSeen) : "—"}</td>
                        <td className={cn("p-2.5 text-xs font-semibold", r.optOut ? "text-muted-foreground" : "text-green-700 dark:text-green-400")}>{r.optOut ? "لغو کرده" : "فعال"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {list.length > shown && <Button variant="outline" className="w-full rounded-xl" onClick={() => setShown((n) => n + PAGE)}>نمایشِ {toFa(Math.min(PAGE, list.length - shown))} مورِد دیگر (از {toFa(list.length - shown)})</Button>}
            </>
          )}
        </Box>

        <Box title="بیشترین مشتری" action={<Users className="size-5 text-primary" />} className="h-fit">
          <div className="space-y-1">
            {data.perTenant.map((t) => (
              <button key={t.slug} onClick={() => setSlug(slug === t.slug ? "" : t.slug)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm transition", slug === t.slug ? "bg-primary/10 font-bold text-primary" : "hover:bg-muted")}>
                <span className="truncate">{t.name}</span><span className="shrink-0 text-xs text-muted-foreground">{toFa(t.count)}</span>
              </button>
            ))}
          </div>
        </Box>
      </div>
    </div>
  );
}
