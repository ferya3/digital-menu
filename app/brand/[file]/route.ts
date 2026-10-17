import fs from "node:fs";
import path from "node:path";
import { ASSETS_DIR } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

/** فایل‌های خودِ پلتفرم (لوگو) از data/platform-assets */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = path.basename((await params).file);
  if (!/^[\w.-]+\.webp$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.promises.readFile(path.join(ASSETS_DIR, name));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
