import { useEffect, useState } from "react";
import { Loader2, Download, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchCustomers, customersCsvUrl, type Customer } from "@/api";

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (v: string | number) => String(v).replace(/[0-9]/g, (d) => faDigits[+d]);
const dateFa = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
};

export default function StaffCustomers() {
  const [rows, setRows] = useState<Customer[] | null>(null);

  useEffect(() => {
    fetchCustomers().then(setRows).catch(() => setRows([]));
  }, []);

  if (!rows) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {toFa(rows.length)} مشتری
        </div>
        {rows.length > 0 && (
          <a href={customersCsvUrl()} download>
            <Button variant="outline" className="rounded-xl">
              <Download className="h-4 w-4" /> خروجی CSV
            </Button>
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">هنوز شماره‌ای ثبت نشده.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((c) => (
            <div key={c.phone} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary">
                <Phone className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold" dir="ltr">{toFa(c.phone)}</div>
                <div className="text-xs text-muted-foreground">
                  {toFa(c.visits)} مراجعه
                  {c.tables && c.tables.length ? ` · میز ${c.tables.map((t) => toFa(t)).join("، ")}` : ""}
                </div>
              </div>
              <div className="text-left text-[11px] text-muted-foreground">
                <div>اولین: {dateFa(c.firstSeen)}</div>
                <div>آخرین: {dateFa(c.lastSeen)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
