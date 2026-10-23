import { startSession } from "@/lib/auth";
import { verifyPlatform } from "@/lib/platform";
import { currentTenant, saasEnabled } from "@/lib/tenant-context";
import { tenantRoute } from "@/lib/tenant";
import { consumeOnce } from "@/lib/limits";

export const dynamic = "force-dynamic";

// Relative URL: keeps the protocol/domain behind a reverse proxy
const back = (q = "") => new Response(null, { status: 303, headers: { Location: "/staff" + q } });

/** Auto sign-in to the panel via a signed platform link (after signup, or "Sign in" from the super admin panel) */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    if (!saasEnabled()) return back();
    const d = verifyPlatform<{ slug: string; p: string }>(new URL(req.url).searchParams.get("t"));
    // Each link works once — recorded in data/limits.db (stays used across server restarts)
    if (!d || d.p !== "enter" || d.slug !== currentTenant().slug || !consumeOnce("enter:" + d.n, 3600_000)) return back("?enter=expired");
    await startSession();
    return back("?welcome=1");
  });
}
