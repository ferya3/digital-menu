/** Accepted formats for all image inputs (webp etc. are listed explicitly so the file picker shows them all) */
export const IMAGE_ACCEPT = "image/*,.webp,.avif,.heic,.heif,.png,.jpg,.jpeg,.gif,.bmp";

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob | null>((res) => c.toBlob((b) => res(b), type, q));

/** Decodes the image any way the browser can (Image, then createImageBitmap) */
async function decode(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close: () => void } | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode"));
      i.src = url;
    });
    if (img.naturalWidth) return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {}
  URL.revokeObjectURL(url);
  try {
    const bm = await createImageBitmap(file);
    return { src: bm, w: bm.width, h: bm.height, close: () => bm.close() };
  } catch {}
  return null;
}

/**
 * Resizes and compresses an image on the user's device before upload (5 MB phone photo → a few hundred KB).
 * - webp / png / avif / gif / heic, etc.: whatever the browser can decode
 * - Transparent images (logos without background) stay transparent (WebP/PNG); regular photos become JPEG
 * - If the browser can't decode the format (old browser), the original file is sent and the server converts it with sharp
 */
export async function compressImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const d = await decode(file);
  if (!d) {
    if (file.size > 10 * 1024 * 1024) throw new Error("This browser can't open this image format and the file is larger than 10 MB");
    return file; // the server converts it
  }
  try {
    const scale = Math.min(1, max / Math.max(d.w, d.h));
    const w = Math.max(1, Math.round(d.w * scale));
    const h = Math.max(1, Math.round(d.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Your browser doesn't support image processing");
    ctx.drawImage(d.src, 0, 0, w, h);
    // Transparent? (sample a small copy)
    let alpha = false;
    try {
      const s = document.createElement("canvas");
      s.width = 48; s.height = 48;
      const sc = s.getContext("2d", { willReadFrequently: true })!;
      sc.drawImage(canvas, 0, 0, 48, 48);
      const px = sc.getImageData(0, 0, 48, 48).data;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { alpha = true; break; }
    } catch {}
    if (alpha) {
      const wp = await toBlob(canvas, "image/webp", quality);
      if (wp && wp.type === "image/webp") return wp;
      const pg = await toBlob(canvas, "image/png");
      if (pg) return pg;
    }
    // Regular photo: white background + JPEG
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const oc = out.getContext("2d")!;
    oc.fillStyle = "#fff";
    oc.fillRect(0, 0, w, h);
    oc.drawImage(canvas, 0, 0);
    const jpg = await toBlob(out, "image/jpeg", quality);
    if (jpg) return jpg;
    if (file.size <= 10 * 1024 * 1024) return file;
    throw new Error("Image compression failed");
  } finally {
    d.close();
  }
}

/** Wraps the file in FormData to send to a Server Action */
export function imageForm(blob: Blob, extra: Record<string, string> = {}): FormData {
  const ext = /webp/.test(blob.type) ? "webp" : /png/.test(blob.type) ? "png" : /jpe?g/.test(blob.type) ? "jpg" : "img";
  const fd = new FormData();
  fd.append("file", blob, `image.${ext}`);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}
