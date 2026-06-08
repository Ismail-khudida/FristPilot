"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthState } from "@/app/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mb-2 text-2xl font-semibold text-navy">FristPilot</div>
        <p className="text-sm text-ink-soft">
          Wir senden dir einen Link zum Zurücksetzen deines Passworts.
        </p>
      </div>

      <div className="card">
        <h1 className="mb-5 text-lg font-semibold text-ink">
          Passwort vergessen
        </h1>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">
              E-Mail-Adresse
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="field-input"
              placeholder="name@beispiel.de"
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
              {state.error}
            </p>
          )}
          {state.message && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {state.message}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Bitte warten…" : "Link senden"}
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
