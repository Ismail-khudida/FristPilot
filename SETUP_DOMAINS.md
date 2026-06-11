# Eigene Domains: fristpilot.com & fristpilot.app

Die App ist im Code bereits **multi-domain-fähig** vorbereitet:

- `APP_ORIGIN` (in `wrangler.toml`) listet alle erlaubten Domains – der
  CSRF-/Upload-Schutz akzeptiert sie alle gleichzeitig.
- Bestätigungs-/Reset-E-Mails zeigen automatisch auf die Domain, auf der der
  Nutzer gerade ist (workers.dev **oder** fristpilot.com/.app).
- `NEXT_PUBLIC_APP_URL` (kanonische URL für Erinnerungs-Mails) steht auf
  `https://fristpilot.com`.

Damit die Domains **live** funktionieren, musst du folgende Einstellungen
außerhalb des Codes setzen. Code-Änderungen sind dafür **nicht** nötig.

---

## 1. Cloudflare – Domains mit dem Worker verbinden

1. Sorge dafür, dass `fristpilot.com` und `fristpilot.app` als **Zonen** in
   deinem Cloudflare-Account liegen (Cloudflare-Nameserver beim Registrar
   eintragen, falls die Domains woanders registriert sind). Bei Registrierung
   über Cloudflare Registrar sind sie schon drin.
2. **Workers & Pages → `fristpilot` → Settings → Domains & Routes →
   Add → Custom Domain**, und füge nacheinander hinzu:
   - `fristpilot.com`
   - `www.fristpilot.com`
   - `fristpilot.app`
3. Cloudflare legt DNS-Einträge (CNAME/Proxy) und das TLS-Zertifikat
   automatisch an. Nach ein paar Minuten ist die App unter den Domains
   erreichbar.

> Die `workers.dev`-URL bleibt parallel erreichbar und funktioniert weiter.

### Optional: www → root weiterleiten
Wenn `www.fristpilot.com` auf `fristpilot.com` zeigen soll, dafür in Cloudflare
eine **Redirect Rule** (Bulk Redirect oder Rule: `www.fristpilot.com/*` →
`https://fristpilot.com/$1`, 301) anlegen.

---

## 2. Supabase – Auth-URLs ergänzen

**Authentication → URL Configuration**
(https://supabase.com/dashboard/project/wudgeccenmwthkurqddp/auth/url-configuration)

- **Site URL:** `https://fristpilot.com`
- **Redirect URLs** (hinzufügen, vorhandene behalten):
  ```
  https://fristpilot.com/**
  https://www.fristpilot.com/**
  https://fristpilot.app/**
  https://fristpilot.ismailkhudida.workers.dev/**
  ```

Ohne diese Einträge schlägt die Registrierungs-Bestätigung auf der neuen Domain
fehl (Supabase akzeptiert nur erlaubte Redirect-Ziele).

---

## 3. Resend – Absender-Domain verifizieren (für Erinnerungs-Mails)

1. Resend → **Domains → Add Domain** → `fristpilot.com`.
2. Die angezeigten **DNS-Einträge** (SPF, DKIM, ggf. DMARC) in Cloudflare DNS
   eintragen. Verifizierung abwarten.
3. Danach in `wrangler.toml` den Absender umstellen und neu deployen:
   ```toml
   REMINDER_FROM_EMAIL = "FristPilot <noreply@fristpilot.com>"
   ```
   (Erst nach erfolgreicher Verifizierung – sonst lehnt Resend den Versand ab.)

---

## 4. pg_cron – Erinnerungs-Aufruf (optional umstellen)

Der tägliche Aufruf funktioniert weiter über die workers.dev-URL. Wenn du ihn
sauber auf die neue Domain umstellen willst, im Supabase SQL-Editor:

```sql
select cron.unschedule('fristpilot-reminders');
select cron.schedule(
  'fristpilot-reminders', '0 7 * * *',
  $$ select net.http_post(
       url := 'https://fristpilot.com/api/cron/reminders',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     ); $$
);
```

---

## 5. Nach dem Umzug

- Testen: Registrierung + Bestätigungslink auf `https://fristpilot.com`.
- Testen: Dokument-Upload auf der neuen Domain (CSRF/Origin akzeptiert sie).
- `wrangler.toml` ist bereits korrekt; ein erneuter Deploy ist nur nötig, wenn
  du `REMINDER_FROM_EMAIL` umstellst.

> **Impressum/Datenschutz** nennen keine konkrete Domain im Text – hier ist
> nichts zu ändern. Die Datenschutz-Tabelle führt Cloudflare bereits als
> Hosting-Anbieter.
