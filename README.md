# FristPilot

FristPilot ist eine Web-App, die deutschsprachigen Nutzern hilft, wichtige
Fristen aus Dokumenten zu erkennen. Ein Dokument (PDF, JPG oder PNG) wird
hochgeladen, von einer KI ausgewertet und in einfacher Sprache erklärt –
inklusive erkannter Fristen, empfohlener nächster Schritte und speicherbarer
Erinnerungen.

> **Hinweis:** Die App liefert keine Rechtsberatung. Jede Analyse kann Fehler
> enthalten und sollte vom Nutzer selbst geprüft werden.

## Tech-Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Supabase** – Auth, PostgreSQL, Storage
- **Anthropic Claude** (`claude-opus-4-8`) – serverseitige Dokumentanalyse

Dokumente werden direkt an Claude übergeben: PDFs als Dokument-Block, Bilder als
Bild-Block. Damit übernimmt das Modell Texterkennung (OCR) und Analyse in einem
Schritt – ein separates OCR-Tool ist nicht nötig.

## Setup

### 1. Abhängigkeiten installieren

```bash
cd fristpilot
npm install
```

### 2. Supabase-Projekt einrichten

1. Auf [supabase.com](https://supabase.com) ein Projekt erstellen.
2. Im **SQL Editor** das Skript `supabase/schema.sql` ausführen. Es legt die
   Tabellen `documents` und `reminders`, die Row-Level-Security-Policies und den
   Storage-Bucket `documents` an. Das Skript ist idempotent und enthält das
   vollständige aktuelle Datenmodell – für eine **frische** Datenbank reicht
   `schema.sql` allein.

   Für eine **bestehende** Datenbank die Migrationen in `supabase/migrations/`
   in Reihenfolge ausführen (idempotent):
   - `0002_document_status.sql` – fügt `documents.status` (`processing` /
     `done` / `failed`) und `analysis_error` hinzu; bestehende Dokumente mit
     Analyse werden auf `done` gesetzt.
   - `0003_analysis_usage.sql` – legt die Tabelle `analysis_usage` und die
     Rate-Limit-Funktionen an.
   - `0004_upload_consents.sql` – legt die Tabelle `upload_consents` für die
     DSGVO-Einwilligung zur Anthropic-Datenübermittlung an.
   - `0005_analysis_feedback.sql` – legt die Tabelle `analysis_feedback` für
     Nutzerfeedback zur Analysequalität (hilfreich / nicht hilfreich) an.
3. Unter **Settings → API** die Projekt-URL und die Keys kopieren.
4. Optional unter **Authentication → Providers → Email** einstellen, ob eine
   E-Mail-Bestätigung erforderlich ist (für lokale Tests kann sie deaktiviert
   werden).
5. Unter **Authentication → URL Configuration** die Redirect-URL
   `<APP_ORIGIN>/auth/callback` zur Allowlist hinzufügen (lokal
   `http://localhost:3000/auth/callback`). Sie wird für E-Mail-Bestätigung und
   Passwort-Reset benötigt.

### 3. Umgebungsvariablen

`.env.example` nach `.env.local` kopieren und ausfüllen:

```bash
cp .env.example .env.local
```

| Variable | Beschreibung |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Projekt-URL aus Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/Public Key |
| `SUPABASE_STORAGE_BUCKET` | Bucket-Name (Standard: `documents`) |
| `APP_ORIGIN` | **Pflicht in Produktion.** Eigene App-Domain für CSRF-Schutz & E-Mail-Links (lokal `http://localhost:3000`). Muss mit der in Supabase konfigurierten Redirect-URL übereinstimmen. |
| `DAILY_USER_ANALYSIS_LIMIT` | optional, Analysen pro Nutzer/Tag (Standard `10`) |
| `DAILY_GLOBAL_ANALYSIS_LIMIT` | optional, globale Analysen pro Tag (Standard `200`) |
| `ANTHROPIC_API_KEY` | API-Key von Anthropic |
| `ANTHROPIC_MODEL` | optional, Standard `claude-opus-4-8` |
| `SENTRY_DSN` | optional, Sentry-DSN für Fehlertracking. Wenn nicht gesetzt, läuft die App ohne Monitoring. |

> Ein Service-Role-Key wird nicht mehr benötigt: Upload und Löschen laufen über
> den session-gebundenen Client, abgesichert durch RLS- und Storage-Policies.

### Redirect-URLs in Supabase konfigurieren

Unter **Authentication → URL Configuration** in Supabase muss die App-Origin
als erlaubte Redirect-URL eingetragen sein:

```
<APP_ORIGIN>/auth/callback
```

Lokal: `http://localhost:3000/auth/callback`  
Produktion: `https://deine-domain.de/auth/callback`

Diese URL wird für E-Mail-Bestätigung und Passwort-Reset verwendet.

### Datenschutz & Impressum (Pflicht vor Betrieb)

Die Seiten `/privacy` und `/imprint` enthalten Platzhalter, die vor dem
Betrieb durch echte Angaben ersetzt werden müssen:

- **Impressum** (`src/app/imprint/page.tsx`): Name, Anschrift, Kontakt
- **Datenschutzerklärung** (`src/app/privacy/page.tsx`): Verantwortlicher,
  Kontakt, AVV-Dokumentation für Anthropic und Supabase

Alle Platzhalter sind visuell mit gelbem Hintergrund markiert.

### Anthropic-Hinweis für Nutzer

Hochgeladene Dokumente werden zur Analyse an **Anthropic, PBC** (San Francisco,
USA) übermittelt. Nutzer müssen vor dem ersten Upload explizit einwilligen
(gespeichert in `upload_consents`). Diese Einwilligung ist Rechtsgrundlage
für die Drittlandübermittlung nach Art. 6 Abs. 1 lit. a DSGVO.

Vor dem produktiven Betrieb sollte ein **Auftragsverarbeitungsvertrag (AVV)**
mit Anthropic abgeschlossen und geprüft werden, ob Standardvertragsklauseln
nach Art. 46 DSGVO erforderlich sind.

### 4. Entwicklungsserver starten

```bash
npm run dev
```

Die App ist unter `http://localhost:3000` erreichbar.

## Hauptablauf

1. Registrieren oder anmelden (`/register`, `/login`).
2. Dashboard öffnen (`/dashboard`).
3. Dokument hochladen (`/upload`) – die Datei wird gespeichert und analysiert.
4. Ergebnisansicht (`/documents/[id]`): Dokumenttyp, Absender, Zusammenfassung,
   **mögliche** Fristen, empfohlene Schritte und Wichtigkeit. Jede mögliche
   Frist ist nachvollziehbar – mit Confidence, der zugrunde liegenden
   Textstelle (Evidence) und – falls bestimmbar – der Seitennummer.
5. Aus einer Frist eine Erinnerung erstellen.
6. Erinnerungen verwalten (`/reminders`) und im Dashboard im Blick behalten.
7. Dokumente bei Bedarf vollständig löschen (Datei im Storage, Datenbankeintrag,
   Analyse und verknüpfte Erinnerungen).

## Vertrauen & Datenschutz

- Fristen werden konsequent als **mögliche** Fristen formuliert – keine
  Rechtsberatung, keine vorgetäuschte Sicherheit.
- `<LegalDisclaimer />` (Haftung) und `<PrivacyNotice />` (KI-Hinweis)
  erscheinen überall dort, wo Analyseergebnisse angezeigt werden.
- Das Analyse-JSON wird serverseitig mit einem **Zod-Schema** validiert; bei
  fehlerhaften KI-Antworten greift ein sicherer Fallback (`src/lib/analysis-schema.ts`).
- Der Claude-Modellname kommt ausschließlich aus `ANTHROPIC_MODEL`
  (Fallback: `claude-opus-4-8`).
- **Kostenkontrolle:** pro Nutzer und global ein Tageslimit für Analysen
  (`analysis_usage`-Tabelle + serverseitige DB-Funktionen). Bei Erreichen
  → HTTP 429, kein Storage-/Claude-Aufruf.
- **Auth-Flows:** Passwort vergessen/zurücksetzen, E-Mail-Bestätigung mit
  Resend und ein `/auth/callback`, der den Supabase-Code gegen eine Session
  tauscht. Login respektiert das ursprüngliche Ziel (nur relative Pfade).

## Projektstruktur

```
fristpilot/
├── supabase/schema.sql        # Datenbank-Schema, RLS, Storage-Bucket
├── middleware.ts              # Session-Refresh + Routenschutz
└── src/
    ├── app/
    │   ├── login, register/   # Authentifizierung
    │   ├── auth/actions.ts     # Login/Register/Logout (Server Actions)
    │   ├── api/upload/         # Upload + Analyse (Route Handler)
    │   └── (app)/              # Geschützte Bereiche
    │       ├── dashboard/
    │       ├── upload/
    │       ├── documents/[id]/
    │       └── reminders/      # Liste + Server Actions
    ├── components/             # UI-Bausteine
    └── lib/
        ├── ai.ts               # Claude-Analyse
        ├── supabase/           # Client-/Server-/Middleware-Helfer
        ├── format.ts           # Datums-/Risiko-Formatierung
        └── types.ts
```

## Nicht im MVP enthalten

Kalenderintegration, Familienmodus, Vertragskündigung, Bankanbindung,
Gesundheitsdaten, Mobile App, Push Notifications, komplexe Rollen, Chatbot.
