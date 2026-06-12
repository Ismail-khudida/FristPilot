import type { MetadataRoute } from "next";

const SITE_URL = "https://ordwell.de";

// Öffentliche Marketing-/Rechtsseiten dürfen indexiert werden. Der eingeloggte
// App-Bereich und API-Routen werden ausgeschlossen.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/documents", "/upload", "/reminders", "/contracts"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
