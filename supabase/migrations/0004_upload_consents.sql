-- Migration 0004: upload_consents
-- Speichert die explizite Einwilligung zur Dokumentenübermittlung an Anthropic.
-- Idempotent (IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS upload_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version text NOT NULL DEFAULT '1',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Jeder Nutzer hat maximal einen Eintrag pro Version.
CREATE UNIQUE INDEX IF NOT EXISTS upload_consents_user_version_uidx
  ON upload_consents (user_id, consent_version);

-- RLS: Nutzer können nur eigene Zeilen lesen und anlegen.
ALTER TABLE upload_consents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'upload_consents' AND policyname = 'Users can read own consents'
  ) THEN
    CREATE POLICY "Users can read own consents"
      ON upload_consents FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'upload_consents' AND policyname = 'Users can insert own consents'
  ) THEN
    CREATE POLICY "Users can insert own consents"
      ON upload_consents FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
