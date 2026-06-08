import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase-Client für Server Components, Server Actions und Route Handler.
// Liest/schreibt die Session über Cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` aus einer Server Component heraus aufgerufen – kann
            // ignoriert werden, wenn die Middleware die Session aktualisiert.
          }
        },
      },
    },
  );
}

// Hinweis: Es gibt bewusst keinen Service-Role-Client mehr. Upload und Löschen
// laufen über den session-gebundenen Client; die RLS- und Storage-Policies
// (Ordner user_id/...) sind die Schutzschicht. So bleibt der Blast-Radius klein.
