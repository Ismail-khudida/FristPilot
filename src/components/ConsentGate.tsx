"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { recordConsent } from "@/app/(app)/upload/actions";
import { PrivacyNotice } from "./PrivacyNotice";

interface ConsentGateProps {
  /** Wird gerendert, sobald die Einwilligung vorliegt. */
  children: React.ReactNode;
}

/**
 * Zeigt einen Einwilligungsdialog, bevor Nutzer Dokumente hochladen dürfen.
 * Sobald die Einwilligung gespeichert ist, wird der Upload-Bereich eingeblendet.
 * Die Komponente wird nur client-seitig gerendert wenn noch keine Einwilligung
 * vorliegt – die Upload-Seite prüft den Status serverseitig und übergibt
 * `initialConsent` als Prop.
 */
export function ConsentGate({
  children,
  initialConsent,
}: ConsentGateProps & { initialConsent: boolean }) {
  const [consented, setConsented] = useState(initialConsent);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (consented) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) {
      setError("Bitte bestätige die Einwilligung, um fortzufahren.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordConsent();
      if (result.error) {
        setError(result.error);
      } else {
        setConsented(true);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            Einwilligung zur Dokumentenverarbeitung
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Bevor du dein erstes Dokument hochlädst, benötigen wir deine
            Zustimmung zur Datenverarbeitung.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-surface-muted p-4 text-sm leading-relaxed text-ink">
          <p className="font-medium">Was passiert mit deinen Dokumenten?</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-soft">
            <li>
              Dokumente werden auf sicheren Servern von{" "}
              <strong>Supabase</strong> gespeichert.
            </li>
            <li>
              Zur Analyse werden die Inhalte an{" "}
              <strong>Anthropic</strong> (USA) übermittelt – dem Anbieter des
              verwendeten KI-Dienstes.
            </li>
            <li>
              Kein anderer Nutzer hat Zugriff auf deine Dokumente.
            </li>
            <li>
              Du kannst Dokumente jederzeit selbst löschen.
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-navy"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              disabled={isPending}
            />
            <span className="text-sm text-ink">
              Ich habe die{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-navy underline"
              >
                Datenschutzerklärung
              </Link>{" "}
              gelesen und stimme zu, dass meine hochgeladenen Dokumente zur
              Analyse an den KI-Dienst <strong>Anthropic</strong> übermittelt
              werden.
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || !checked}
            className="btn-primary"
          >
            {isPending ? "Wird gespeichert…" : "Einwilligung bestätigen & fortfahren"}
          </button>
        </form>
      </div>

      <PrivacyNotice />
    </div>
  );
}
