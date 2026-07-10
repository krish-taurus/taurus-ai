/**
 * robots.txt (Sprint 055 — Landing v3 SEO).
 *
 * Public marketing + marketplace surfaces are crawlable; authenticated product
 * surfaces are not meaningful to index (they redirect to login anyway).
 */

import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://thetaurus.ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/onboarding/", "/api/", "/operator/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
