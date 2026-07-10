/**
 * XML sitemap (Sprint 055 — Landing v3 SEO).
 *
 * The public, indexable surfaces: the landing story, the public AI Employee
 * Marketplace, and the auth entry points.
 */

import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://thetaurus.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/marketplace`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
