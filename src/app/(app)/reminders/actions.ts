"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ReminderActionState {
  error?: string;
  success?: boolean;
}

// Erstellt eine Erinnerung aus einer erkannten Frist (oder manuell).
export async function createReminder(
  _prev: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  if (!title) return { error: "Bitte einen Titel angeben." };

  const { error } = await supabase.from("reminders").insert({
    user_id: user.id,
    document_id: documentId || null,
    title,
    description: description || null,
    due_date: dueDateRaw || null,
    status: "open",
  });

  if (error) {
    return { error: "Die Erinnerung konnte nicht gespeichert werden." };
  }

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  if (documentId) revalidatePath(`/documents/${documentId}`);
  return { success: true };
}

// Schaltet eine Erinnerung zwischen offen und erledigt um.
export async function toggleReminder(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("status") ?? "") === "done"
    ? "done"
    : "open";

  await supabase
    .from("reminders")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}

// Löscht eine Erinnerung.
export async function deleteReminder(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  await supabase.from("reminders").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}
