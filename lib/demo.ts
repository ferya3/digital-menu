import type { ActionFail } from "@/lib/action-result";

/**
 * Live-demo mode (DEMO_MODE=1): everything a visitor needs to try the product works
 * (ordering, Stripe test payments, the kitchen flow, browsing every panel), while actions
 * that could break or deface the public demo are refused. Data is reset by demo-reset.sh.
 */
export const demoMode = () => process.env.DEMO_MODE === "1";
export const DEMO_MESSAGE = "This action is disabled in the live demo";
export const demoFail = (): ActionFail => ({ __error: DEMO_MESSAGE });

/** Shown on the login screens of the demo (empty outside demo mode) */
export function demoHints() {
  if (!demoMode()) return null;
  return {
    admin: process.env.DEMO_ADMIN_PASSWORD || "",
    staff: process.env.DEMO_STAFF_PASSWORD || "",
    resetHours: Number(process.env.DEMO_RESET_HOURS) || 0,
  };
}
