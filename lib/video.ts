import "server-only";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getSetting, setSetting } from "@/lib/queries";
import { uploadsDir, deleteUpload } from "@/lib/images";
import type { CafeInfo } from "@/lib/types";
import { currentTenant, runAsTenant } from "@/lib/tenant-context";

let hasFfmpeg: boolean | null = null;
export function ffmpegAvailable(): boolean {
  if (hasFfmpeg === null) {
    try {
      hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
    } catch {
      hasFfmpeg = false;
    }
  }
  return hasFfmpeg;
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg " + code))));
  });
}

const running = new Set<string>();

/**
 * Optimizes the hero video for the web (in the background): max 1280px, H.264, muted, max 20 seconds,
 * faststart for instant playback + a cover image (poster). The original video is removed on success.
 */
export function optimizeHeroVideo(webPath: string) {
  const { slug } = currentTenant();
  const key = `${slug}:${webPath}`;
  if (!ffmpegAvailable() || running.has(key)) return false;
  const src = path.join(uploadsDir(), path.basename(webPath));
  if (!fs.existsSync(src)) return false;
  running.add(key);
  const base = `hero-${Date.now()}`;
  const outVideo = path.join(uploadsDir(), `${base}-web.mp4`);
  const tmpPoster = path.join(uploadsDir(), `${base}-poster.jpg`);
  const outPoster = path.join(uploadsDir(), `${base}-poster.webp`);
  // The background job explicitly runs in the same venue's context
  runAsTenant(slug, () => (async () => {
    try {
      await run([
        "-y", "-i", src, "-t", "20", "-an",
        "-vf", "scale='min(1280,iw)':-2,fps=30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", outVideo,
      ]);
      await run(["-y", "-ss", "0.3", "-i", outVideo, "-frames:v", "1", tmpPoster]).catch(() => {});
      let poster = "";
      if (fs.existsSync(tmpPoster)) {
        fs.writeFileSync(outPoster, await sharp(tmpPoster).resize(1280, 1280, { fit: "inside" }).webp({ quality: 70 }).toBuffer());
        fs.rmSync(tmpPoster, { force: true });
        poster = "/uploads/" + path.basename(outPoster);
      }
      const cur = getSetting<CafeInfo>("cafe", { name: "My Café", logo: "☕", tagline: "", currency: "USD" });
      // If the video was changed/removed meanwhile, discard the result
      if (cur.heroVideo !== webPath) {
        fs.rmSync(outVideo, { force: true });
        if (poster) deleteUpload(poster);
        return;
      }
      setSetting("cafe", { ...cur, heroVideo: "/uploads/" + path.basename(outVideo), heroPoster: poster });
      deleteUpload(webPath);
      if (cur.heroPoster) deleteUpload(cur.heroPoster);
    } catch (e) {
      fs.rmSync(outVideo, { force: true });
      fs.rmSync(tmpPoster, { force: true });
      console.error("[hero-video] optimization failed:", e instanceof Error ? e.message : e);
    } finally {
      running.delete(key);
    }
  })());
  return true;
}
