import { PlatformHome } from "@/components/platform/home";
import { publicPlatform } from "./public";

export const dynamic = "force-dynamic";

/** صفحهٔ اصلیِ پلتفرم (دامنهٔ اصلی) */
export default function PlatformPage() {
  return <PlatformHome p={publicPlatform()} />;
}
