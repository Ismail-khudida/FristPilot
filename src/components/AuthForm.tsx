"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, register, type AuthState } from "@/app/auth/actions";

interface AuthFormProps {
  mode: "login" | "register";
  /** Nur Login: relatives Ziel nach erfolgreicher Anmeldung. */
  redirectTo?: string;
  /** Optionaler Hinweis (z. B. nach Passwort-Reset). */
  notice?: string;
}

export function AuthForm({ mode, redirectTo, notice }: AuthFormProps) {
  const action = mode === "login" ? login : register;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  const isLogin = mode === "login";

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mb-2 text-2xl font-semibold text-navy">Ordwell</div>
        <p className="text-sm font-medium text-ink">
          Dein KI-Assistent für Fristen und wichtige Dokumente.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {isLogin
            ? "Willkommen zurück. Melde dich an, um deine Dokumente zu sehen."
            : "Kostenlos registrieren und sofort loslegen. Kein Abo."}
        </p>
      </div>

      <div className="card">
        <h1 className="mb-5 text-lg font-semibold text-ink">
          {isLogin ? "Anmelden" : "Registrieren"}
        </h1>

        {notice && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {notice}
          </p>
        )}

        <form action={formAction} className="space-y-4">
          {isLogin && redirectTo && (
            <input type="hidden" name="redirect" value={redirectTo} />
          )}

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

          <div>
            <label htmlFor="password" className="field-label">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={isLogin ? undefined : 8}
              className="field-input"
              placeholder={isLogin ? "Dein Passwort" : "Mindestens 8 Zeichen"}
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
            {pending
              ? "Bitte warten…"
              : isLogin
                ? "Anmelden"
                : "Konto erstellen"}
          </button>
        </form>

        {isLogin && (
          <p className="mt-4 text-center text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-navy underline"
            >
              Passwort vergessen?
            </Link>
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {isLogin ? (
          <>
            Noch kein Konto?{" "}
            <Link href="/register" className="font-medium text-navy underline">
              Jetzt registrieren
            </Link>
          </>
        ) : (
          <>
            Bereits registriert?{" "}
            <Link href="/login" className="font-medium text-navy underline">
              Anmelden
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
