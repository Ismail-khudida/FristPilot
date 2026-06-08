import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

// Layout für alle angemeldeten Bereiche: prüft die Session und zeigt die
// Navigation. Die Middleware leitet bereits um, dies ist die zweite Absicherung.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <NavBar email={user.email ?? null} />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
