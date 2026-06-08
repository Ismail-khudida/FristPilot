"use client";

import { useActionState } from "react";
import { resendConfirmation, type AuthState } from "@/app/auth/actions";

export function ResendConfirmationForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    resendConfirmation,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
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
      )}

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

      <button type="submit" disabled={pending} className="btn-secondary w-full">
        {pending ? "Bitte warten…" : "Bestätigungslink erneut senden"}
      </button>
    </form>
  );
}
