import { DEMO_MESSAGE, demoMode } from "@/lib/demo";
import fs from "node:fs";
import path from "node:path";
import { isAuthed } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/queries";
import { uploadsDir, deleteUpload } from "@/lib/images";
import { tenantRoute } from "@/lib/tenant";
import { optimizeHeroVideo } from "@/lib/video";
import type { CafeInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Same-origin requests only (CSRF protection; browsers set the Origin header themselves) */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser requests have no session cookie
  try { return new URL(origin).host === req.headers.get("host"); } catch { return false; }
}

// Videos exceed the Server Actions size limit, so they are streamed straight to disk
const MAX_BYTES = 100 * 1024 * 1024;
const EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};
const DEFAULT_CAFE: CafeInfo = { name: "My Café", logo: "☕", tagline: "", currency: "USD" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** Hero video upload: the request body is the file itself (Content-Type = video type) */
export async function POST(req: Request) {
  if (demoMode()) return Response.json({ error: DEMO_MESSAGE }, { status: 403 });
  return tenantRoute(async () => {
    if (!sameOrigin(req)) return json({ ok: false, error: "Invalid request" }, 403);
    if (!(await isAuthed())) return json({ ok: false, error: "Please sign in first" }, 401);
    const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = EXT[type];
    if (!ext) return json({ ok: false, error: "Only MP4 or WebM videos are allowed" }, 415);
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) return json({ ok: false, error: "The video is larger than 100 MB" }, 413);
    if (!req.body) return json({ ok: false, error: "No file was sent" }, 400);

    fs.mkdirSync(uploadsDir(), { recursive: true });
    const file = `hero-${Date.now()}${ext}`;
    const full = path.join(uploadsDir(), file);
    const out = fs.createWriteStream(full);
    let size = 0;
    try {
      const reader = req.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error("The video is larger than 100 MB");
        }
        if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
      }
      await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
      if (size === 0) throw new Error("The file is empty");
    } catch (e) {
      out.destroy();
      fs.rmSync(full, { force: true });
      return json({ ok: false, error: e instanceof Error ? e.message : "Upload failed" }, 400);
    }

    const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
    if (cur.heroVideo) deleteUpload(cur.heroVideo);
    if (cur.heroPoster) deleteUpload(cur.heroPoster);
    const heroVideo = "/uploads/" + file;
    setSetting("cafe", { ...cur, heroVideo, heroPoster: "" });
    // Optimize in the background (if ffmpeg is installed on the server)
    const optimizing = optimizeHeroVideo(heroVideo);
    return json({ ok: true, heroVideo, optimizing });
  });
}

/** Remove the video → the hero falls back to the 3D scene */
export async function DELETE(req: Request) {
  if (demoMode()) return Response.json({ error: DEMO_MESSAGE }, { status: 403 });
  return tenantRoute(async () => {
    if (!sameOrigin(req)) return json({ ok: false, error: "Invalid request" }, 403);
    if (!(await isAuthed())) return json({ ok: false, error: "Please sign in first" }, 401);
    const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
    if (cur.heroVideo) deleteUpload(cur.heroVideo);
    if (cur.heroPoster) deleteUpload(cur.heroPoster);
    setSetting("cafe", { ...cur, heroVideo: "", heroPoster: "" });
    return json({ ok: true });
  });
}

/** Optimize the current video (for videos uploaded before this feature existed) */
export async function PATCH(req: Request) {
  if (demoMode()) return Response.json({ error: DEMO_MESSAGE }, { status: 403 });
  return tenantRoute(async () => {
    if (!sameOrigin(req)) return json({ ok: false, error: "Invalid request" }, 403);
    if (!(await isAuthed())) return json({ ok: false, error: "Please sign in first" }, 401);
    const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
    if (!cur.heroVideo) return json({ ok: false, error: "There is no video" }, 400);
    if (/-web\.mp4$/.test(cur.heroVideo)) return json({ ok: true, optimizing: false, already: true });
    const optimizing = optimizeHeroVideo(cur.heroVideo);
    if (!optimizing) return json({ ok: false, error: "ffmpeg is not installed on the server — run update.sh once" }, 400);
    return json({ ok: true, optimizing });
  });
}
