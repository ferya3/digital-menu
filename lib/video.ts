import "server-only";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getSetting, setSetting } from "@/lib/queries";
import { UPLOADS, deleteUpload } from "@/lib/images";
import type { CafeInfo } from "@/lib/types";

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
 * ویدیوی هیرو را برای وب سبک می‌کند (پس‌زمینه): حداکثر ۱۲۸۰px، H.264، بی‌صدا، حداکثر ۲۰ ثانیه،
 * faststart برای شروعِ فوریِ پخش + یک عکسِ کاور (poster). ویدیوی اصلی بعد از موفقیت حذف می‌شود.
 */
export function optimizeHeroVideo(webPath: string) {
  if (!ffmpegAvailable() || running.has(webPath)) return false;
  const src = path.join(UPLOADS, path.basename(webPath));
  if (!fs.existsSync(src)) return false;
  running.add(webPath);
  const base = `hero-${Date.now()}`;
  const outVideo = path.join(UPLOADS, `${base}-web.mp4`);
  const tmpPoster = path.join(UPLOADS, `${base}-poster.jpg`);
  const outPoster = path.join(UPLOADS, `${base}-poster.webp`);
  (async () => {
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
      const cur = getSetting<CafeInfo>("cafe", { name: "کافه", logo: "☕", tagline: "", currency: "toman" });
      // اگر در این فاصله ویدیو عوض/حذف شده، نتیجه را دور بریز
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
      console.error("[hero-video] بهینه‌سازی انجام نشد:", e instanceof Error ? e.message : e);
    } finally {
      running.delete(webPath);
    }
  })();
  return true;
}
