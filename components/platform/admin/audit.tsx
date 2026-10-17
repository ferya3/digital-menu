"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminAuditAction } from "@/app/platform/actions";
import type { AuditRow } from "@/lib/platform-admin";
import { Box, downloadCsv, err, smallField, type Flash } from "./shared";

/** گزارشِ فعالیت: کارهای مدیرِ کل، ورودهای ناموفق، ثبت‌نام‌ها و پرداخت‌ها */
export function AuditLog({ flash }: { flash: Flash }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => adminAuditAction(q).then((r) => setRows(unwrap(r))).catch((e) => flash("❌ " + err(e))), 250);
    return () => window.clearTimeout(t);
  }, [q, flash]);
  return (
    <Box title="گزارشِ فعالیت" action={rows && rows.length > 0 && (
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => downloadCsv("audit.csv", [["زمان", "انجام‌دهنده", "کار", "مجموعه", "جزئیات", "IP"], ...rows.map((r) => [r.at, r.actor, r.action, r.target, r.detail, r.ip])])}>
        <Download className="size-4" /> خروجی اکسل
      </Button>
    )}>
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: کار، مجموعه، جزئیات…" className={cn(smallField, "pr-9")} />
      </div>
      {!rows ? <Loader2 className="mx-auto animate-spin text-muted-foreground" /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">موردی نیست</p> : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["زمان", "انجام‌دهنده", "کار", "مجموعه", "جزئیات", "IP"].map((h) => <th key={h} className="p-2.5 text-right font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-t border-border", /ناموفق|حذف/.test(r.action) && "bg-primary/5")}>
                  <td className="whitespace-nowrap p-2.5 text-xs text-muted-foreground">{faDateTime(r.at)}</td>
                  <td className="p-2.5 text-xs">{r.actor}</td>
                  <td className="p-2.5 font-semibold">{r.action}</td>
                  <td className="p-2.5 text-xs" dir="ltr">{r.target}</td>
                  <td className="p-2.5 text-xs text-muted-foreground">{r.detail}</td>
                  <td className="p-2.5 text-xs text-muted-foreground" dir="ltr">{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Box>
  );
}
