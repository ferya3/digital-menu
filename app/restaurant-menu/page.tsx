import { SolutionRoute, solutionMetadata } from "@/app/platform/seo-routes";

export const dynamic = "force-dynamic";
export const generateMetadata = () => solutionMetadata("restaurant-menu");

export default function Page() {
  return <SolutionRoute slug="restaurant-menu" />;
}
