"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Home, Sparkles, UtensilsCrossed, Coffee } from "lucide-react";
import { useUI } from "@/store/ui";
import { scrollToId } from "@/components/fx/smooth-scroll";

const LINKS = [
  { id: "top", label: "خانه", icon: Home },
  { id: "signature", label: "امضای ما", icon: Sparkles },
  { id: "menu", label: "منو", icon: UtensilsCrossed },
];

export function MobileMenu({ cafeName }: { cafeName: string }) {
  const { menuOpen, setMenu } = useUI();
  const go = (id: string) => {
    setMenu(false);
    window.setTimeout(() => scrollToId(id), 60);
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
              {LINKS.map((l) => (
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
            <p className="mt-6 text-xs text-muted-foreground">با ❤️ توسط {cafeName}</p>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
