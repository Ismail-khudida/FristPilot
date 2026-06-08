"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

export interface DeleteDocumentState {
  error?: string;
}

// Löscht ein Dokument vollständig: verknüpfte Erinnerungen, Datenbankeintrag
// (inkl. Analyse-JSON) und die Datei im Storage. Mit Ownership-Prüfung.
export async function deleteDocument(
  _prev: DeleteDocumentState,
  formData: FormData,
): Promise<DeleteDocumentState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Ungültige Anfrage." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // 1. Ownership prüfen und Storage-Pfad lesen (RLS erlaubt nur eigene Zeilen).
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, file_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !doc) {
    return { error: "Dokument nicht gefunden." };
  }

  // 2. Verknüpfte Erinnerungen entfernen.
  const { error: remindersError } = await supabase
    .from("reminders")
    .delete()
    .eq("document_id", id)
    .eq("user_id", user.id);

  if (remindersError) {
    return { error: "Verknüpfte Erinnerungen konnten nicht gelöscht werden." };
  }

  // 3. Datenbankeintrag (inkl. analysis_json) löschen.
  const { error: docError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (docError) {
    return { error: "Das Dokument konnte nicht gelöscht werden." };
  }

  // 4. Datei aus dem Storage entfernen (best effort, nach DB-Löschung).
  //    Session-gebundener Client – die Storage-Policy erlaubt nur den eigenen
  //    user_id/...-Ordner, daher kein Service-Role-Key nötig.
  if (doc.file_url) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.file_url]);
    if (storageError) {
      // DB ist bereits konsistent gelöscht; verwaiste Datei nur protokollieren.
      console.error("Storage-Datei konnte nicht gelöscht werden:", storageError);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/reminders");
  redirect("/dashboard");
}
