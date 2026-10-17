import "server-only";
import { platformSettings, platformSmsReady } from "@/lib/platform";
import { contentVars, siteContent } from "@/lib/platform-admin";
import { rootDomain } from "@/lib/tenant-context";
import { fillDeep } from "@/lib/site-content";
import type { PublicPlatform } from "@/components/platform/home";

/** فقط اطلاعاتِ عمومیِ پلتفرم (بدونِ کلیدها و رمزها) + محتوای سایت با متغیرهای جایگذاری‌شده */
export function publicPlatform(): PublicPlatform {
  const s = platformSettings();
  const raw = siteContent();
  return {
    trialDays: s.trialDays, allowSignup: s.allowSignup, plans: s.plans, root: rootDomain(), otp: platformSmsReady(),
    c: fillDeep(raw, contentVars(raw)),
  };
}
