/**
 * مقاله‌های وبلاگِ سایتِ پلتفرم (برای سئو): در تنظیماتِ پلتفرم ذخیره می‌شوند و از پنلِ مدیرِ کل ← «مقالات» ویرایش.
 * تا وقتی چیزی ذخیره نشده، مقاله‌های آغازین (lib/article-seeds) نمایش داده می‌شوند.
 */
export interface Article {
  /** بخشِ آدرس: /blog/<slug> — حروفِ انگلیسیِ کوچک، عدد و خط‌تیره */
  slug: string;
  title: string;
  /** توضیحِ نتیجهٔ گوگل (حدودِ ۱۲۰ تا ۱۶۰ نویسه) */
  description: string;
  /** عکسِ کاور (اختیاری؛ ۱۶۰۰×۹۰۰) */
  cover: string;
  /** متن با مارک‌داونِ ساده: ## تیتر، ### زیرتیتر، - فهرست، 1. فهرستِ شماره‌دار، > نکته، **پررنگ**، [متن](/آدرس) */
  body: string;
  published: boolean;
  /** YYYY-MM-DD */
  date: string;
  updated: string;
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** زمانِ تقریبیِ خواندن (دقیقه) — حدودِ ۲۰۰ کلمه در دقیقه برای فارسی */
export const readMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
