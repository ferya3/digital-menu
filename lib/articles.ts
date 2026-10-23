/**
 * Platform blog articles (for SEO): stored in the platform settings and edited from super admin → "Articles".
 * Until something is saved, the starter articles (lib/article-seeds) are shown.
 */
export interface Article {
  /** URL segment: /blog/<slug> — lowercase letters, digits and hyphens */
  slug: string;
  title: string;
  /** Search-result description (about 120–160 characters) */
  description: string;
  /** Cover image (optional; 1600×900) */
  cover: string;
  /** Body in simple Markdown: ## heading, ### subheading, - list, 1. numbered list, > tip, **bold**, [text](/url) */
  body: string;
  published: boolean;
  /** YYYY-MM-DD */
  date: string;
  updated: string;
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Approximate reading time (minutes) — about 200 words per minute */
export const readMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
