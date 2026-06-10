import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Verarbeitet Auth-Rücksprünge aus E-Mails (Registrierungs-Bestätigung,
// Passwort-Reset). Unterstützt zwei Verfahren:
//
//  1. token_hash + type  -> verifyOtp. Geräteunabhängig: funktioniert auch,
//     wenn die E-Mail auf einem anderen Gerät/Browser geöffnet wird als dem,
//     auf dem registriert wurde (kein PKCE-Cookie nötig). Das ist der typische
//     Handy-Fall und der Grund für die bisherige Fehlermeldung.
//  2. code -> exchangeCodeForSession (PKCE, gleicher Browser).
//
// Bei Fehlern wird auf /login mit einer verständlichen Meldung geleitet, statt
// die Seite hart fehlschlagen zu lassen.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  // Nur relative Ziele zulassen (kein Open-Redirect).
  const nextParam = url.searchParams.get("next") ?? "/dashboard";
  const next =
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.includes("\\")
      ? nextParam
      : "/dashboard";

  const supabase = await createClient();

  // Verfahren 1: token_hash (geräteunabhängig).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }

  // Verfahren 2: PKCE-code (gleicher Browser).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }

  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
