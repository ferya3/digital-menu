"use client";

import { SmoothScroll } from "@/components/fx/smooth-scroll";
import { MobileMenu } from "@/components/fx/mobile-menu";
import { HeroSplash } from "@/components/fx/hero-splash";
import { ScanGate } from "@/components/fx/scan-gate";
import { MenuView } from "@/components/menu/menu-view";
import type { CafeInfo, Menu, PaymentInfo } from "@/lib/types";

export function Landing({
  menu,
  table,
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
  return (
    <SmoothScroll>
      <MobileMenu cafeName={cafe.name} table={table} />

      {table ? (
        // هیرو (سه‌بعدی یا ویدیو) به‌صورت پاپ‌آپِ خوش‌آمد — فقط بار اولِ هر نشست
        <HeroSplash cafe={cafe} table={table} />
      ) : (
        // بدون شمارهٔ میز: صفحهٔ «QR میز را اسکن کنید»
        <ScanGate cafe={cafe} />
      )}

      {/* ===== MENU + ordering (پنل منتخب‌ها هم داخل همین است تا به همان سبد اضافه شود) ===== */}
      <div id="menu">
        <MenuView menu={menu} table={table} cafe={cafe} payment={payment} otp={otp} payFirst={payFirst} />
      </div>
    </SmoothScroll>
  );
}
