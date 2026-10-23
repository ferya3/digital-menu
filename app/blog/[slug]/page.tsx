import { ArticleRoute, articleMetadata } from "@/app/platform/seo-routes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  return articleMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <ArticleRoute slug={(await params).slug} />;
}
