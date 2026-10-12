"use client";

import { SmoothScroll } from "@/components/fx/smooth-scroll";
import { MobileMenu } from "@/components/fx/mobile-menu";
import { HeroSplash } from "@/components/fx/hero-splash";
import { MenuView } from "@/components/menu/menu-view";
import type { CafeInfo, Menu, PaymentInfo } from "@/lib/types";

export function Landing({
  menu,
  table,
  cafe,
  payment,
}: {
  menu: Menu;
  table: string;
  cafe: CafeInfo;
  payment: PaymentInfo;
}) {
  return (
    <SmoothScroll>
      <MobileMenu cafeName={cafe.name} />

      {/* هیرو (سه‌بعدی یا ویدیو) به‌صورت پاپ‌آپِ خوش‌آمد — فقط بار اولِ هر نشست */}
      <HeroSplash cafe={cafe} table={table} />

      {/* ===== MENU + ordering (پنل منتخب‌ها هم داخل همین است تا به همان سبد اضافه شود) ===== */}
      <div id="menu">
        <MenuView menu={menu} table={table} cafe={cafe} payment={payment} />
      </div>
    </SmoothScroll>
  );
}
