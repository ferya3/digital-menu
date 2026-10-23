import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { onPlatformHost } from "@/lib/tenant";
import { publicPlatform } from "@/app/platform/public";
import { getArticle, publishedArticles } from "@/lib/platform-admin";
import { solutionBySlug } from "@/lib/solutions";
import { fill } from "@/lib/site-content";
import { articleLd, breadcrumbLd, siteOrigin, solutionLd } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { ArticleView, BlogIndex, SolutionView, pageVars } from "@/components/platform/seo-pages";

/**
 * مسیرهای سئوی سایتِ پلتفرم: صفحه‌های موضوعی (/cafe-menu و …)، فهرستِ مقالات (/blog) و هر مقاله.
 * روی زیردامنهٔ مجموعه‌ها وجود ندارند (۴۰۴).
 */
const og = (title: string, description: string, url: string, image: string, type: "website" | "article" = "website", extra: Record<string, unknown> = {}) => ({
  title, description, alternates: { canonical: url },
  openGraph: { type, locale: "fa_IR", url, title, description, images: [{ url: image, ...(image === "/og.png" ? { width: 1200, height: 630 } : {}) }], ...extra },
  twitter: { card: "summary_large_image" as const, title, description, images: [image] },
});

/* ---------- صفحهٔ موضوعی ---------- */
export async function solutionMetadata(slug: string): Promise<Metadata> {
  if (!(await onPlatformHost())) return {};
  const s = solutionBySlug(slug)!;
  const p = publicPlatform();
  const v = pageVars(p);
  return og(fill(s.title, v), fill(s.description, v), `/${slug}`, p.c.brand.ogImage || "/og.png");
}
export async function SolutionRoute({ slug }: { slug: string }) {
  if (!(await onPlatformHost())) notFound();
  const s = solutionBySlug(slug);
  if (!s) notFound();
  const p = publicPlatform();
  const v = pageVars(p);
  const origin = await siteOrigin();
  const filled = { ...s, description: fill(s.description, v), faq: s.faq.map((q) => ({ q: fill(q.q, v), a: fill(q.a, v) })) };
  return (
    <>
      <JsonLd data={solutionLd(origin, filled, p.c.brand.name)} />
      <JsonLd data={breadcrumbLd(origin, [{ name: p.c.brand.name, path: "/" }, { name: s.label }])} />
      <SolutionView p={p} s={s} articles={publishedArticles()} />
    </>
  );
}

/* ---------- وبلاگ ---------- */
export async function blogMetadata(): Promise<Metadata> {
  if (!(await onPlatformHost())) return {};
  const p = publicPlatform();
  return og("مقالات و آموزش‌های منوی دیجیتال", `راهنمای ساختِ منوی QR، سفارش آنلاین سرِ میز و طراحیِ منو برای کافه و رستوران — مجلهٔ ${p.c.brand.name}.`, "/blog", p.c.brand.ogImage || "/og.png");
}
export async function BlogRoute() {
  if (!(await onPlatformHost())) notFound();
  const p = publicPlatform();
  const origin = await siteOrigin();
  return (
    <>
      <JsonLd data={breadcrumbLd(origin, [{ name: p.c.brand.name, path: "/" }, { name: "مقالات" }])} />
      <BlogIndex p={p} articles={publishedArticles()} />
    </>
  );
}

export async function articleMetadata(slug: string): Promise<Metadata> {
  if (!(await onPlatformHost())) return {};
  const a = getArticle(slug);
  if (!a || !a.published) return {};
  const p = publicPlatform();
  const v = pageVars(p);
  return og(fill(a.title, v), fill(a.description, v), `/blog/${a.slug}`, a.cover || p.c.brand.ogImage || "/og.png", "article",
    { publishedTime: a.date, modifiedTime: a.updated || a.date });
}
export async function ArticleRoute({ slug }: { slug: string }) {
  if (!(await onPlatformHost())) notFound();
  const a = getArticle(slug);
  if (!a || !a.published) notFound();
  const p = publicPlatform();
  const v = pageVars(p);
  const origin = await siteOrigin();
  const filled = { ...a, title: fill(a.title, v), description: fill(a.description, v) };
  return (
    <>
      <JsonLd data={articleLd(origin, filled, p.c.brand.name, p.c.brand.logo)} />
      <JsonLd data={breadcrumbLd(origin, [{ name: p.c.brand.name, path: "/" }, { name: "مقالات", path: "/blog" }, { name: filled.title }])} />
      <ArticleView p={p} a={a} related={publishedArticles().filter((x) => x.slug !== a.slug)} />
    </>
  );
}
