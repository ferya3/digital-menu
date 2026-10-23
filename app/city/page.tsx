import { CityIndexRoute, cityIndexMetadata } from "@/app/platform/seo-routes";

export const dynamic = "force-dynamic";
export const generateMetadata = cityIndexMetadata;

export default function Page() {
  return <CityIndexRoute />;
}
