import { CityRoute, cityMetadata } from "@/app/platform/seo-routes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  return cityMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <CityRoute slug={(await params).slug} />;
}
