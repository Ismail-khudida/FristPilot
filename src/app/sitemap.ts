import type { MetadataRoute } from "next";

const SITE_URL = "https://ordwell.de";

// Nur öffentlich erreichbare Seiten. Der App-Bereich liegt hinter Auth und
// gehört nicht in die Sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/demo", "/pricing", "/privacy", "/imprint"];
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
