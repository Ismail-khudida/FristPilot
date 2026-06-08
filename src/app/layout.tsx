import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FristPilot – Fristen aus Dokumenten erkennen",
  description:
    "Lade ein Dokument hoch und FristPilot erklärt es in einfacher Sprache, erkennt mögliche Fristen und hilft dir, nichts zu vergessen.",
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
