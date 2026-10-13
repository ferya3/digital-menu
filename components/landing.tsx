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
  // میز می‌تواند بدونِ بارگذاریِ دوبارهٔ صفحه عوض شود (بعد از اسکنِ QR داخلِ سایت → فوری)
  const [table, setTable] = useState(initialTable);
  const openTable = useCallback((t: string) => {
    try { sessionStorage.removeItem("cafe_browse"); } catch {}
    window.history.replaceState(null, "", `/?table=${encodeURIComponent(t)}`);
    window.scrollTo(0, 0);
    setTable(t);
  }, []);

  return (
    <SmoothScroll>
      <MobileMenu cafeName={cafe.name} table={table} />

      {table ? (
        // هیرو (سه‌بعدی یا ویدیو) به‌صورت پاپ‌آپِ خوش‌آمد — فقط بار اولِ هر نشست
        <HeroSplash cafe={cafe} table={table} />
      ) : (
        // بدون شمارهٔ میز: صفحهٔ «QR میز را اسکن کنید»
        <ScanGate cafe={cafe} onTable={openTable} />
      )}

      {/* ===== MENU + ordering (پنل منتخب‌ها هم داخل همین است تا به همان سبد اضافه شود) ===== */}
      <div id="menu">
        <MenuView menu={menu} table={table} cafe={cafe} payment={payment} otp={otp} payFirst={payFirst} />
      </div>
    </SmoothScroll>
  );
}
