"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Home, Sparkles, UtensilsCrossed, Coffee, LogOut, QrCode } from "lucide-react";
import { useUI } from "@/store/ui";
import { scrollToId } from "@/components/fx/smooth-scroll";
import { picksTitle } from "@/lib/seeds";

const LINKS = [
  { id: "splash", label: "صفحهٔ خوش‌آمد", icon: Home },
  { id: "picks", label: "منتخب باریستا", icon: Sparkles },
  { id: "menu", label: "منو", icon: UtensilsCrossed },
];

/** خروج از میز: حافظهٔ این نشست پاک و صفحهٔ «QR را اسکن کنید» باز می‌شود */
function leaveTable(table: string) {
  if (!confirm(`از میز ${table.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])} خارج می‌شوید؟`)) return;
  try {
    sessionStorage.removeItem(`cafe_visit_t${table}`);
    sessionStorage.removeItem("cafe_splash_seen");
    sessionStorage.removeItem("cafe_browse");
  } catch {}
  window.location.href = "/";
}

export function MobileMenu({ cafeName, table = "", kind }: { cafeName: string; table?: string; kind?: string }) {
  const links = LINKS.map((l) => (l.id === "picks" ? { ...l, label: picksTitle(kind) } : l));
  const { menuOpen, setMenu, setPicks, setSplash } = useUI();
  const go = (id: string) => {
    setMenu(false);
    window.setTimeout(() => (id === "picks" ? setPicks(true) : id === "splash" ? setSplash(true) : scrollToId(id)), 60);
  };
  return (
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMenu(false)}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute inset-y-0 right-0 w-72 max-w-[82vw] bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <Coffee className="size-4" />
                </span>
                <span className="font-extrabold">{cafeName}</span>
              </div>
              <button onClick={() => setMenu(false)} aria-label="بستن" className="grid size-9 place-items-center rounded-full bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {links.filter((l) => table || l.id !== "splash").map((l) => (
                <button
                  key={l.id}
                  onClick={() => go(l.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right font-semibold transition hover:bg-muted"
                >
                  <l.icon className="size-5 text-primary" />
                  {l.label}
                </button>
              ))}
            </nav>
            {!table && (
              <button
                onClick={() => { try { sessionStorage.removeItem("cafe_browse"); } catch {} window.location.href = "/"; }}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-primary px-3 py-3 text-right font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <QrCode className="size-5" />
                اسکن QR میز برای سفارش
              </button>
            )}
            {table && (
              <button
                onClick={() => { setMenu(false); window.setTimeout(() => leaveTable(table), 80); }}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary/20 px-3 py-3 text-right font-semibold text-primary transition hover:bg-primary/5"
              >
                <LogOut className="size-5" />
                خروج از میز {table.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}
              </button>
            )}
            <p className="mt-6 text-xs text-muted-foreground">با ❤️ توسط {cafeName}</p>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
