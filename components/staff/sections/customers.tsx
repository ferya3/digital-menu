"use client";

import { useMemo, useState } from "react";
import { Download, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime, toFa } from "@/lib/utils";
import type { StaffCustomer } from "@/lib/queries";
import { Empty, Panel, inputCls } from "@/components/staff/kit";

export function CustomersSection({ items }: { items: StaffCustomer[] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const d = q.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/\D/g, "");
    return d ? items.filter((c) => c.phone.includes(d)) : items;
  }, [items, q]);

  function exportCsv() {
    const rows = [["شماره موبایل", "میزها", "دفعات", "اولین بازدید", "آخرین بازدید"]];
    items.forEach((c) => rows.push([c.phone, c.tables.join(" | "), String(c.visits), c.firstSeen, c.lastSeen]));
    const csv = "﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      title="بانک شمارهٔ مشتری‌ها"
      icon={<Users className="size-5 text-primary" />}
      count={toFa(items.length)}
      action={items.length > 0 && <Button size="sm" variant="outline" className="rounded-xl" onClick={exportCsv}><Download className="size-4" /> خروجی اکسل (CSV)</Button>}
    >
      {items.length === 0 ? (
        <Empty text="هنوز شماره‌ای ثبت نشده است — با روشن‌کردنِ «تأیید شمارهٔ مشتری» در تنظیمات، شماره‌ها اینجا جمع می‌شوند" />
      ) : (
        <>
          <div className="relative mb-3 max-w-xs">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی شماره" className={cn(inputCls, "pr-9")} />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2.5 text-right font-semibold">#</th>
                  <th className="p-2.5 text-right font-semibold">شماره موبایل</th>
                  <th className="p-2.5 text-right font-semibold">میزها</th>
                  <th className="p-2.5 text-right font-semibold">دفعات</th>
                  <th className="p-2.5 text-right font-semibold">آخرین بازدید</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={c.phone} className="border-t border-border">
                    <td className="p-2.5 text-muted-foreground">{toFa(i + 1)}</td>
                    <td className="p-2.5 font-bold" dir="ltr" style={{ textAlign: "right" }}>{toFa(c.phone)}</td>
                    <td className="p-2.5">{c.tables.map((t) => toFa(t)).join("، ") || "—"}</td>
                    <td className="p-2.5">{toFa(c.visits || 1)}</td>
                    <td className="p-2.5 text-muted-foreground">{faDateTime(c.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
