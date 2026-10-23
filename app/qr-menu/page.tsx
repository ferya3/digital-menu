import { SolutionRoute, solutionMetadata } from "@/app/platform/seo-routes";

export const dynamic = "force-dynamic";
export const generateMetadata = () => solutionMetadata("qr-menu");

export default function Page() {
  return <SolutionRoute slug="qr-menu" />;
}
