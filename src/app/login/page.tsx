import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; reset?: string; error?: string }>;
}) {
  const { redirect, reset, error } = await searchParams;

  // Nur relative Pfade als Redirect-Ziel zulassen (kein Open-Redirect).
  const safe =
    redirect &&
    redirect.startsWith("/") &&
    !redirect.startsWith("//") &&
    !redirect.includes("\\")
      ? redirect
      : undefined;

  const notice =
    reset === "ok"
      ? "Dein Passwort wurde geändert. Bitte melde dich jetzt an."
      : error === "auth"
        ? "Der Link ist ungültig oder abgelaufen. Bitte versuche es erneut."
        : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <AuthForm mode="login" redirectTo={safe} notice={notice} />
    </main>
  );
}
