"use client";

import { useCallback, useState } from "react";
import { SmoothScroll } from "@/components/fx/smooth-scroll";
import { MobileMenu } from "@/components/fx/mobile-menu";
import { HeroSplash } from "@/components/fx/hero-splash";
import { ScanGate } from "@/components/fx/scan-gate";
import { MenuView } from "@/components/menu/menu-view";
import type { CafeInfo, Menu, PaymentInfo } from "@/lib/types";

export function Landing({
  menu,
  table: initialTable,
  cafe,
  payment,
  otp = false,
  payFirst = false,
}: {
  menu: Menu;
  table: string;
  cafe: CafeInfo;
  payment: PaymentInfo;
  otp?: boolean;
  payFirst?: boolean;
}) {
  // The table can change without a page reload (instant after an in-site QR scan)
  const [table, setTable] = useState(initialTable);
  const openTable = useCallback((t: string) => {
    try { sessionStorage.removeItem("cafe_browse"); } catch {}
    window.history.replaceState(null, "", `/?table=${encodeURIComponent(t)}`);
    window.scrollTo(0, 0);
    setTable(t);
  }, []);

  return (
    <SmoothScroll>
      <MobileMenu cafeName={cafe.name} table={table} kind={cafe.kind} />

      {table ? (
        // Hero (3D or video) as a welcome splash — only the first time in each session
        <HeroSplash cafe={cafe} table={table} />
      ) : (
        // No table number: the "Scan your table QR" screen
        <ScanGate cafe={cafe} onTable={openTable} />
      )}

      {/* ===== MENU + ordering (the picks panel lives here too, so it shares the same cart) ===== */}
      <div id="menu">
        <MenuView menu={menu} table={table} cafe={cafe} payment={payment} otp={otp} payFirst={payFirst} />
      </div>
    </SmoothScroll>
  );
}
