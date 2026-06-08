"use server";

import { createClient } from "@/lib/supabase/server";

const CONSENT_VERSION = "1";

export interface ConsentState {
  hasConsent: boolean;
}

/** Prüft, ob für den aktuellen Nutzer eine gültige Einwilligung vorliegt. */
export async function getConsentState(): Promise<ConsentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { hasConsent: false };

  const { data } = await supabase
    .from("upload_consents")
    .select("id")
    .eq("user_id", user.id)
    .eq("consent_version", CONSENT_VERSION)
    .maybeSingle();

  return { hasConsent: !!data };
}

/** Speichert die Einwilligung des Nutzers. Idempotent durch den UNIQUE-Index. */
export async function recordConsent(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Nicht angemeldet." };

  const { error } = await supabase.from("upload_consents").upsert(
    { user_id: user.id, consent_version: CONSENT_VERSION },
    { onConflict: "user_id,consent_version", ignoreDuplicates: true },
  );

  if (error) return { error: "Einwilligung konnte nicht gespeichert werden." };
  return {};
}
