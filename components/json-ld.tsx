import { headers } from "next/headers";

/** دادهٔ ساختاریافته برای گوگل (JSON-LD) — با nonceِ CSP؛ «<» برای جلوگیری از شکستنِ تگ escape می‌شود */
export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
