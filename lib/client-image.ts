/**
 * عکس را قبل از آپلود روی دستگاهِ کاربر کوچک و فشرده می‌کند
 * (عکس ۵ مگابایتیِ گوشی ← چند صد کیلوبایت) و به‌صورت FormData (باینری) آمادهٔ ارسال می‌کند.
 */
export async function compressImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("فایل تصویر قابل خواندن نیست"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("مرورگر از پردازش تصویر پشتیبانی نمی‌کند");
    ctx.fillStyle = "#fff"; // پس‌زمینهٔ سفید برای PNGهای شفاف
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("فشرده‌سازی تصویر ناموفق بود"))), "image/jpeg", quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** فایل را در FormData می‌گذارد تا به Server Action فرستاده شود */
export function imageForm(blob: Blob, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("file", blob, "image.jpg");
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}
