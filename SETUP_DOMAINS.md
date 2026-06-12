# Domain-Setup: ordwell.de

Die App läuft unter der kanonischen Hauptdomain **ordwell.de** (+ `www.ordwell.de`).

## Architektur

- **Cloudflare Worker:** `ordwell` (Deploy via `wrangler deploy`)
- **Fallback-/Test-URL:** `ordwell.ismailkhudida.workers.dev`
- **Custom Domains am Worker:** `ordwell.de`, `www.ordwell.de`
- **DNS/Zone:** ordwell.de in Cloudflare (Free), Registrar Namecheap,
  Nameserver `vin.ns.cloudflare.com` / `zoe.ns.cloudflare.com`
- **Google Search Console:** Domain-Property `ordwell.de` verifiziert per
  DNS-TXT (`google-site-verification=…` – Eintrag muss dauerhaft bleiben).

## Supabase Auth

Authentication → URL Configuration:
- **Site URL:** `https://ordwell.de`
- **Redirect URLs:**
  ```
  https://ordwell.de/**
  https://www.ordwell.de/**
  https://ordwell.ismailkhudida.workers.dev/**
  ```

## E-Mail (Resend)

`REMINDER_FROM_EMAIL` nutzt aktuell `onboarding@resend.dev` (Anzeigename
„Ordwell“). Sobald `ordwell.de` in Resend verifiziert ist (SPF/DKIM/DMARC,
erfordert Resend Pro oder Domain-Tausch), umstellen auf:
```toml
REMINDER_FROM_EMAIL = "Ordwell <noreply@ordwell.de>"
```

## pg_cron (Supabase)

Zwei Jobs rufen die App über die Hauptdomain auf (Bearer = `CRON_SECRET`):
- `ordwell-reminders` · `0 7 * * *` · `POST https://ordwell.de/api/cron/reminders`
- `ordwell-cron-health` · `0 9 * * *` · `POST https://ordwell.de/api/cron/health`
