"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword, type AuthState } from "@/app/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mb-2 text-2xl font-semibold text-navy">Ordwell</div>
        <p className="text-sm text-ink-soft">Wähle ein neues Passwort.</p>
      </div>

      <div className="card">
        <h1 className="mb-5 text-lg font-semibold text-ink">
          Passwort zurücksetzen
        </h1>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="password" className="field-label">
              Neues Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="field-input"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="field-label">
              Passwort bestätigen
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="field-input"
              placeholder="Passwort wiederholen"
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Bitte warten…" : "Passwort speichern"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-navy underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
