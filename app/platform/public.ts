import "server-only";
import { platformSettings, platformSmsReady } from "@/lib/platform";
import { rootDomain } from "@/lib/tenant-context";
import type { PublicPlatform } from "@/components/platform/home";

/** فقط اطلاعاتِ عمومیِ پلتفرم (بدونِ کلیدها و رمزها) برای صفحه‌های سایت */
export function publicPlatform(): PublicPlatform & { otp: boolean } {
  const s = platformSettings();
  return {
    brand: s.brand, tagline: s.tagline, support: s.support, trialDays: s.trialDays, allowSignup: s.allowSignup,
    plans: s.plans, root: rootDomain(), otp: platformSmsReady(),
  };
}
