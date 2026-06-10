"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";

const LINKS = [
  { href: "/dashboard", label: "Überblick" },
  { href: "/documents", label: "Dokumente" },
  { href: "/contracts", label: "Verträge" },
  { href: "/reminders", label: "Erinnerungen" },
  { href: "/upload", label: "Hochladen" },
];

export function NavBar({ email }: { email: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold text-navy">
          FristPilot
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  active
                    ? "bg-navy text-white"
                    : "text-ink-soft hover:bg-surface-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm text-ink-soft">
          {email && <span className="hidden sm:inline">{email}</span>}
          <form action={logout}>
            <button type="submit" className="font-medium text-navy underline">
              Abmelden
            </button>
          </form>
        </div>
      </div>
      <div className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto flex max-w-4xl gap-4 px-4 py-1.5 text-xs text-ink-soft">
          <Link href="/pricing" className="hover:underline">Preise</Link>
          <Link href="/privacy" className="hover:underline">Datenschutz</Link>
          <Link href="/imprint" className="hover:underline">Impressum</Link>
        </div>
      </div>
    </header>
  );
}
