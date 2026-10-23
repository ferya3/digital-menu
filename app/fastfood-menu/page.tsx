import { SolutionRoute, solutionMetadata } from "@/app/platform/seo-routes";

export const dynamic = "force-dynamic";
export const generateMetadata = () => solutionMetadata("fastfood-menu");

export default function Page() {
  return <SolutionRoute slug="fastfood-menu" />;
}
