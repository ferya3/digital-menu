import { Star, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Feedback } from "@/api";

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (v: string | number) => String(v).replace(/[0-9]/g, (d) => faDigits[+d]);
const when = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
};

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-4 w-4", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
      ))}
    </div>
  );
}

export default function StaffFeedback({ items }: { items: Feedback[] }) {
  const avg = items.length ? items.reduce((s, f) => s + f.rating, 0) / items.length : 0;

  if (items.length === 0) {
    return <p className="py-20 text-center text-muted-foreground">هنوز نظری ثبت نشده.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="text-3xl font-black text-amber-500">{toFa(avg.toFixed(1))}</div>
        <div>
          <Stars n={Math.round(avg)} />
          <div className="mt-1 text-xs text-muted-foreground">میانگین از {toFa(items.length)} نظر</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((f) => (
          <div key={f.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between">
              <Stars n={f.rating} />
              {f.table && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">میز {toFa(f.table)}</span>}
            </div>
            {f.comment ? (
              <p className="flex gap-1.5 text-sm text-foreground">
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                {f.comment}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">بدون توضیح</p>
            )}
            <div className="mt-2 text-[11px] text-muted-foreground">{when(f.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
