"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

// Verhindert Open-Redirects: nur relative Pfade auf dieser App erlauben.
function safeRedirect(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  if (
    !v.startsWith("/") ||
    v.startsWith("//") ||
    v.includes("\\") ||
    v.includes("://")
  ) {
    return "/dashboard";
  }
  return v;
}

// Absolute App-Origin für E-Mail-Redirect-Links.
async function getOrigin(): Promise<string> {
  const fromEnv = process.env.APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Anmeldung fehlgeschlagen. Bitte prüfe deine Daten." };
  }

  const target = safeRedirect(formData.get("redirect"));
  revalidatePath("/", "layout");
  redirect(target);
}

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }
  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });

  if (error) {
    return { error: "Registrierung fehlgeschlagen. Bitte versuche es erneut." };
  }

  // Keine aktive Session -> E-Mail-Bestätigung erforderlich.
  if (!data.session) {
    redirect(`/confirm-email?email=${encodeURIComponent(email)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// Passwort vergessen: Reset-Link anfordern. Aus Datenschutzgründen immer eine
// neutrale Erfolgsmeldung, auch wenn die E-Mail unbekannt ist.
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Bitte E-Mail-Adresse eingeben." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return {
    message:
      "Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt.",
  };
}

// Neues Passwort setzen (benötigt aktive Recovery-Session aus dem Callback).
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }
  if (password !== confirm) {
    return { error: "Die Passwörter stimmen nicht überein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Das Passwort konnte nicht geändert werden." };
  }

  // Recovery-Session beenden, damit sich der Nutzer mit dem neuen Passwort
  // anmeldet und die Bestätigung auf der Login-Seite sieht.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?reset=ok");
}

// Bestätigungs-E-Mail erneut senden. Neutrale Meldungen.
export async function resendConfirmation(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Bitte E-Mail-Adresse eingeben." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });

  return {
    message:
      "Falls noch eine Bestätigung aussteht, haben wir dir die E-Mail erneut gesendet.",
  };
}
