# Setup: Erinnerungs-Versand & neue Optimierungen

Dieser Stand enthält die umgesetzten Punkte aus dem strategischen Audit.
Code-seitig ist alles fertig. Drei Dinge musst **du** noch wiring/eintragen,
weil sie Keys, externe Konten oder persönliche Angaben brauchen.

## 1. Supabase-Migration ausführen (Pflicht)

Im Supabase SQL-Editor nacheinander ausführen (falls noch nicht geschehen):

- `supabase/migrations/0005_analysis_feedback.sql`
- `supabase/migrations/0006_reminder_dispatch.sql`  ← **neu**

## 2. E-Mail-Versand für Erinnerungen aktivieren

Die App hat jetzt einen Cron-Endpunkt: `POST /api/cron/reminders`.
Er verschickt fällige Erinnerungen (heute + 3 Tage Vorlauf) per E-Mail und
markiert sie als versendet, damit niemand doppelt benachrichtigt wird.

### a) Resend-Konto (oder anderer Anbieter)
1. Konto bei https://resend.com anlegen, Domain verifizieren.
2. API-Key erzeugen.

### b) Secrets in Cloudflare setzen (Worker → Settings → Variables, als *Secret*)
- `CRON_SECRET` = beliebiges langes Zufalls-Token (schützt den Endpunkt)
- `RESEND_API_KEY` = dein Resend-Key
- `SUPABASE_SERVICE_ROLE_KEY` = bereits gesetzt (wird hier serverseitig genutzt)

`REMINDER_FROM_EMAIL` und `NEXT_PUBLIC_APP_URL` stehen in `wrangler.toml` –
Absender-Adresse ggf. auf deine verifizierte Domain anpassen.

### c) Scheduler einrichten (eine der Optionen)

**Option A – Externer Cron (am einfachsten):**
Bei z. B. https://cron-job.org täglich 07:00 Uhr aufrufen:
```
POST https://fristpilot.ismailkhudida.workers.dev/api/cron/reminders
Header: Authorization: Bearer <CRON_SECRET>
```

**Option B – Supabase pg_cron + pg_net:**
```sql
select cron.schedule(
  'fristpilot-reminders', '0 7 * * *',
  $$ select net.http_post(
       url := 'https://fristpilot.ismailkhudida.workers.dev/api/cron/reminders',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     ); $$
);
```

### Testen
```
curl -X POST https://fristpilot.ismailkhudida.workers.dev/api/cron/reminders \
  -H "Authorization: Bearer <CRON_SECRET>"
```
Antwort z. B. `{"sent":1,"reminders":2}`.

## 3. Impressum & Datenschutz vervollständigen (Pflicht vor Launch)

Diese Angaben kann nur **du** liefern (echte Pflichtdaten):
- `src/app/imprint/page.tsx` und `src/app/privacy/page.tsx`:
  Name, Anschrift, Kontakt-E-Mail an den `[PLATZHALTER]`-Stellen eintragen.
- Auftragsverarbeitungsverträge (AVV) mit Supabase und Anthropic dokumentieren.

---

## Was bereits im Code erledigt ist

- **Modell auf `claude-sonnet-4-6`** umgestellt (günstiger, gleichwertig für
  OCR/Extraktion). Über `ANTHROPIC_MODEL` jederzeit überschreibbar.
- **Privacy by Default:** Originaldatei wird nach der Analyse automatisch
  gelöscht, `extracted_text` wird nicht mehr dauerhaft gespeichert.
- **Landing-/Datenschutz-Texte** an die tatsächliche Verarbeitung angepasst
  (kein falscher „wird nicht weitergegeben"-Claim mehr).
- **`/demo`-Seite:** risikofreies Beispiel-Ergebnis ohne eigenen Upload,
  von Landing und Upload verlinkt (Conversion bei Vertrauens-Zögerern).
- **Erinnerungs-Versand** komplett implementiert (siehe Punkt 2).
