# Eigene Domains: fristpilot.app (Haupt) & fristpilot.com

Beide Domains sind bereits **in Cloudflare angelegt** (Free-Plan, Status
„pending"). Der Code ist multi-domain-fähig; `fristpilot.app` ist die
**kanonische Hauptdomain** (`NEXT_PUBLIC_APP_URL`), `fristpilot.com` läuft mit.

Es fehlen nur noch die Schritte außerhalb des Codes (DNS/Supabase/Resend).

---

## 1. name.com – Nameserver auf Cloudflare umstellen  ← DU

Damit Cloudflare die Domains aktiviert, bei **name.com** für **beide** Domains
die Nameserver ersetzen:

1. Bei https://www.name.com einloggen → Domain auswählen → **Nameservers**.
2. Die vier name.com-Nameserver **entfernen**
   (`ns1ljp.name.com`, `ns2dqx.name.com`, `ns3cpr.name.com`, `ns4kmw.name.com`).
3. Diese **zwei Cloudflare-Nameserver** eintragen:
   ```
   vin.ns.cloudflare.com
   zoe.ns.cloudflare.com
   ```
4. Speichern. **Für fristpilot.app UND fristpilot.com** machen.

Cloudflare aktiviert die Domains automatisch (meist Minuten bis wenige Stunden)
und schickt dir eine Bestätigungs-Mail. Solange läuft die App weiter über
workers.dev.

> Sag mir Bescheid, wenn Cloudflare „Active" meldet – dann mache ich Schritt 2 + 3.

---

## 2. Cloudflare – Custom Domain am Worker  ← ich (nach Aktivierung)

Workers & Pages → `fristpilot` → Settings → Domains & Routes → **Add Custom
Domain**:
- `fristpilot.app`
- `www.fristpilot.app`
- `fristpilot.com`
- `www.fristpilot.com`

Cloudflare ersetzt dabei die geparkten A-Records automatisch und stellt TLS
bereit. (Die importierten name.com-Parking-Records `91.195.240.94` werden dabei
überschrieben.)

---

## 3. Supabase – Auth-URLs  ← ich (nach Aktivierung)

Authentication → URL Configuration:
- **Site URL:** `https://fristpilot.app`
- **Redirect URLs** (hinzufügen, vorhandene behalten):
  ```
  https://fristpilot.app/**
  https://www.fristpilot.app/**
  https://fristpilot.com/**
  https://www.fristpilot.com/**
  https://fristpilot.ismailkhudida.workers.dev/**
  ```

---

## 4. Resend – Absender-Domain verifizieren  ← DU (+ ich für DNS)

1. Resend → Domains → Add Domain → `fristpilot.app`.
2. Die angezeigten DNS-Einträge (SPF/DKIM/DMARC) nenne ich dir – ich trage sie
   dann in Cloudflare DNS ein.
3. Nach Verifizierung in `wrangler.toml` umstellen + deployen:
   ```toml
   REMINDER_FROM_EMAIL = "FristPilot <noreply@fristpilot.app>"
   ```

---

## 5. pg_cron – Erinnerungs-Aufruf (optional umstellen)

Läuft weiter über workers.dev. Zum Umstellen im Supabase-SQL-Editor:
```sql
select cron.unschedule('fristpilot-reminders');
select cron.schedule('fristpilot-reminders','0 7 * * *',
  $$ select net.http_post(
       url := 'https://fristpilot.app/api/cron/reminders',
       headers := jsonb_build_object('Authorization','Bearer <CRON_SECRET>')); $$);
```

---

## Aktueller Stand
- ✅ fristpilot.app + fristpilot.com in Cloudflare angelegt (Free, pending)
- ✅ Code: Multi-Domain + `fristpilot.app` kanonisch (deployt)
- ⏳ name.com-Nameserver-Umstellung (Schritt 1) – **dein Schritt**
- ⏳ Custom Domain + Supabase + Resend – danach
