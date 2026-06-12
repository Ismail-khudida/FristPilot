import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://ordwell.de";
const TITLE = "Ordwell – Fristen aus Dokumenten erkennen";
const DESCRIPTION =
  "Lade ein Dokument hoch und Ordwell erklärt es in einfacher Sprache, erkennt mögliche Fristen und hilft dir, nichts zu vergessen.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Ordwell",
  },
  description: DESCRIPTION,
  applicationName: "Ordwell",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SITE_URL,
    siteName: "Ordwell",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
