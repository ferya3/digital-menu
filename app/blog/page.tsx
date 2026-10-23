import { BlogRoute, blogMetadata } from "@/app/platform/seo-routes";

export const dynamic = "force-dynamic";
export const generateMetadata = blogMetadata;

export default function Page() {
  return <BlogRoute />;
}
