"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/auth/actions";

const LINKS = [
  { href: "/dashboard", label: "Überblick" },
  { href: "/documents", label: "Dokumente" },
  { href: "/reminders", label: "Erinnerungen" },
  { href: "/upload", label: "Hochladen" },
];

export function NavBar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="text-lg font-semibold text-navy"
        >
          Ordwell
        </Link>

        {/* Desktop-Navigation */}
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-navy text-white"
                  : "text-ink-soft hover:bg-surface-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop: E-Mail + Abmelden */}
        <div className="ml-auto hidden items-center gap-3 text-sm text-ink-soft sm:flex">
          {email && <span className="hidden md:inline">{email}</span>}
          <form action={logout}>
            <button type="submit" className="font-medium text-navy underline">
              Abmelden
            </button>
          </form>
        </div>

        {/* Mobile: Menü-Button */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-ink sm:hidden"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobiles Menü-Panel */}
      {open && (
        <div className="border-t border-gray-100 bg-white sm:hidden">
          <nav className="mx-auto flex max-w-4xl flex-col px-2 py-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-navy text-white"
                    : "text-ink hover:bg-surface-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-gray-100 px-3 pt-2">
              {email && (
                <span className="truncate text-xs text-ink-soft">{email}</span>
              )}
              <form action={logout}>
                <button type="submit" className="text-sm font-medium text-navy underline">
                  Abmelden
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}

      {/* Sekundäre Links */}
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
