# Neue Hauptdomain: ordwell.de

Im Zuge des Rebrandings (FristPilot → **Ordwell**) wird `ordwell.de` zur neuen
**kanonischen Hauptdomain** (`NEXT_PUBLIC_APP_URL`). Der Code ist multi-domain-
fähig: die bestehenden `fristpilot.app`/`fristpilot.com` bleiben technisch
gültig (in `APP_ORIGIN`) und können später per Redirect auf `ordwell.de`
zeigen.

> **Wichtig – technische Identifier bleiben unverändert:**
> - Der Cloudflare-Worker heißt weiterhin **`fristpilot`** (Umbenennung würde
>   einen neuen Worker anlegen und Domains/Secrets/Cron abreißen).
> - Die Fallback-Domain bleibt `fristpilot.ismailkhudida.workers.dev`.
> Beides ist für Nutzer unsichtbar und kein Branding.

Domain `ordwell.de` ist bei **Namecheap** registriert.

---

## 1. Namecheap → Cloudflare: Domain hinzufügen + Nameserver  ← DU

1. In Cloudflare (Account `dc4a4b2efcc2ee12f7b289c216f69126`) → **Add a Site**
   → `ordwell.de` (Free-Plan).
2. Cloudflare nennt zwei Nameserver (vermutlich dieselben wie bei den
   fristpilot-Domains: `vin.ns.cloudflare.com` / `zoe.ns.cloudflare.com` —
   die in Cloudflare angezeigten Werte sind maßgeblich).
3. Bei **Namecheap** (https://ap.www.namecheap.com) → Domain List → `ordwell.de`
   → **Manage** → Nameservers → **Custom DNS** → die zwei Cloudflare-Nameserver
   eintragen → speichern.
4. Etwaige Namecheap-Parking-Records (A-Record auf Parking-IP, CNAME
   `www → parkingpage`) entfernen, damit sie die Custom Domain nicht blockieren.

Cloudflare aktiviert die Domain automatisch (Minuten bis wenige Stunden) und
schickt eine Bestätigungs-Mail. Bis dahin läuft die App weiter über die
bestehenden Domains.

> Sag mir Bescheid, sobald Cloudflare „Active" meldet – dann mache ich
> Schritt 2 + 3.

---

## 2. Cloudflare – Custom Domain am Worker  ← ich (nach Aktivierung)

Workers & Pages → **`fristpilot`** (Worker-Name bleibt) → Settings → Domains &
Routes → **Add Custom Domain**:
- `ordwell.de`
- `www.ordwell.de`

Cloudflare legt die nötigen DNS-Records an und stellt TLS bereit.

---

## 3. Supabase – Auth-URLs  ← ich (nach Aktivierung)

Authentication → URL Configuration:
- **Site URL:** `https://ordwell.de`
- **Redirect URLs** (hinzufügen, vorhandene behalten):
  ```
  https://ordwell.de/**
  https://www.ordwell.de/**
  https://fristpilot.app/**
  https://www.fristpilot.app/**
  https://fristpilot.com/**
  https://www.fristpilot.com/**
  https://fristpilot.ismailkhudida.workers.dev/**
  ```

---

## 4. Resend – Absender-Domain verifizieren  ← DU (+ ich für DNS)

1. Resend → Domains → Add Domain → `ordwell.de`.
2. Die angezeigten DNS-Einträge (SPF/DKIM/DMARC) nenne ich dir – ich trage sie
   dann in Cloudflare DNS ein.
3. Nach Verifizierung in `wrangler.toml` umstellen + deployen:
   ```toml
   REMINDER_FROM_EMAIL = "Ordwell <noreply@ordwell.de>"
   ```
   (Bis dahin läuft der Versand weiter über `onboarding@resend.dev`.)

---

## 5. pg_cron – Erinnerungs-Aufruf (auf ordwell.de umstellen)

Läuft weiter über die bestehende URL. Zum Umstellen im Supabase-SQL-Editor:
```sql
select cron.unschedule('fristpilot-reminders');
select cron.schedule('ordwell-reminders','0 7 * * *',
  $$ select net.http_post(
       url := 'https://ordwell.de/api/cron/reminders',
       headers := jsonb_build_object('Authorization','Bearer <CRON_SECRET>')); $$);
```
> Der Cron-Job-Name ist frei wählbar; der alte `fristpilot-reminders` sollte
> vorher entplant werden, damit nicht doppelt verschickt wird.

---

## 6. Alte Domains weiterleiten (optional, später)

Sobald `ordwell.de` live ist, können `fristpilot.app`/`.com` per Cloudflare
**Redirect Rule** (301) auf `ordwell.de` zeigen, damit Bestandslinks nicht ins
Leere laufen. Solange sie in `APP_ORIGIN` stehen, funktionieren sie aber auch
ohne Redirect weiter.

---

## Aktueller Stand
- ✅ Code: vollständig auf Ordwell rebrandet, `ordwell.de` als kanonische Domain
- ✅ `ordwell.de` bei Namecheap registriert
- ⏳ Cloudflare-Site + Nameserver-Umstellung (Schritt 1) – **dein Schritt**
- ⏳ Custom Domain + Supabase + Resend – danach
- ℹ️ fristpilot.app/.com bleiben funktional (Bestand), Worker-Name bleibt `fristpilot`
