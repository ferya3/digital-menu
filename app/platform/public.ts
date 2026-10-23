import "server-only";
import { platformSettings, platformSmsReady } from "@/lib/platform";
import { contentVars, siteContent } from "@/lib/platform-admin";
import { rootDomain } from "@/lib/tenant-context";
import { fillDeep } from "@/lib/site-content";
import { setPlatformCurrency } from "@/lib/utils";
import type { PublicPlatform } from "@/components/platform/home";

/** Public platform info only (no keys or passwords) + site content with variables filled in */
export function publicPlatform(): PublicPlatform {
  const s = platformSettings();
  setPlatformCurrency(s.currency);
  const raw = siteContent();
  return {
    currency: s.currency, trialDays: s.trialDays, allowSignup: s.allowSignup, plans: s.plans, root: rootDomain(), otp: platformSmsReady(),
    c: fillDeep(raw, contentVars(raw)),
  };
}
