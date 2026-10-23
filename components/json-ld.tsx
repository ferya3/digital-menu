import { headers } from "next/headers";

/** Structured data for search engines (JSON-LD) — with the CSP nonce; "<" is escaped so the tag can't be broken */
export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
