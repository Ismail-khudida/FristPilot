import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeDocument } from "@/lib/ai";
import { detectFileType, isAllowedOrigin } from "@/lib/upload";
import {
  checkQuota,
  consumeQuota,
  finalizeQuota,
  quotaMessage,
} from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";

// KI-Analyse kann einige Sekunden dauern.
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

export async function POST(request: Request) {
  // 1. CSRF-Schutz: nur Anfragen von der eigenen App-Domain zulassen.
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
  }

  // 2. Authentifizierung (session-gebundener Client, RLS aktiv).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  // 3. Multipart-Body lesen.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Bitte eine Datei auswählen." },
      { status: 400 },
    );
  }
  // Opt-in: Original nach der Analyse behalten (Standard: löschen).
  const keepOriginal = formData.get("keep_original") === "true";
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Die Datei ist zu groß (max. 10 MB)." },
      { status: 400 },
    );
  }

  // 4. Echten Dateityp anhand der Magic Bytes bestimmen (nicht file.type).
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectFileType(buffer);
  if (!detected) {
    return NextResponse.json(
      { error: "Nur echte PDF-, JPG- oder PNG-Dateien werden unterstützt." },
      { status: 400 },
    );
  }

  // 5. Rate-Limit VOR Upload, DB-Anlage und Claude prüfen.
  const quota = await checkQuota(supabase);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quotaMessage(quota.reason) },
      { status: 429 },
    );
  }

  // 6. Dokumentzeile zuerst anlegen (status='processing'), damit eine spätere
  //    Datei stets durch eine Eigentümer-Zeile referenziert wird.
  const { data: created, error: createError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_type: detected.mime,
      status: "processing",
    })
    .select("id")
    .single();

  if (createError || !created) {
    return NextResponse.json(
      { error: "Das Dokument konnte nicht angelegt werden." },
      { status: 500 },
    );
  }

  const documentId = created.id as string;
  const storagePath = `${user.id}/${documentId}.${detected.ext}`;

  const cleanupStorage = async () => {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) console.error("Storage-Cleanup fehlgeschlagen:", error);
  };
  const deleteDocumentRow = async () => {
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", user.id);
    if (error) console.error("Dokumentzeile konnte nicht entfernt werden:", error);
  };
  const markFailed = async (message: string) => {
    const { error } = await supabase
      .from("documents")
      .update({ status: "failed", analysis_error: message, file_url: null })
      .eq("id", documentId)
      .eq("user_id", user.id);
    if (error) console.error("Status 'failed' konnte nicht gesetzt werden:", error);
  };

  // 7. Datei in den Storage legen (session-gebundener Client, RLS schützt
  //    den user_id/...-Ordner).
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: detected.mime,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload fehlgeschlagen:", uploadError);
    await captureError(uploadError, { category: "storage", extra: { documentId } });
    // Upload fehlgeschlagen -> kein Verbrauch buchen (Claude lief nie).
    await markFailed("Die Datei konnte nicht gespeichert werden.");
    return NextResponse.json(
      { error: "Die Datei konnte nicht gespeichert werden.", documentId },
      { status: 500 },
    );
  }

  // 8. Verbrauch buchen, unmittelbar vor dem Claude-Aufruf. Sollte das Limit
  //    zwischen Vorprüfung und hier (Race) erreicht worden sein, wieder
  //    aufräumen und 429 zurückgeben.
  const consumed = await consumeQuota(supabase);
  if (!consumed.allowed) {
    await cleanupStorage();
    await deleteDocumentRow();
    return NextResponse.json(
      { error: quotaMessage(consumed.reason) },
      { status: 429 },
    );
  }

  // 9. Analyse durchführen. Verbrauch ist gebucht und zählt ab jetzt, auch
  //    wenn Claude fehlschlägt (Kosten können entstanden sein).
  try {
    const analysis = await analyzeDocument({
      data: buffer,
      mimeType: detected.mime,
    });

    // Datenschutz-by-Default: Wir speichern nur das strukturierte Analyse-
    // Ergebnis. Der Originalinhalt (extracted_text) wird NICHT dauerhaft in der
    // DB abgelegt, und die hochgeladene Datei wird nach der Analyse sofort aus
    // dem Storage gelöscht – außer der Nutzer hat beim Upload ausdrücklich
    // "Original behalten" gewählt (Archiv-Funktion, Opt-in).
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        file_url: keepOriginal ? storagePath : null,
        extracted_text: null,
        analysis_json: analysis,
        category: analysis.category ?? "sonstiges",
        status: "done",
        analysis_error: null,
      })
      .eq("id", documentId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Speichern der Analyse fehlgeschlagen:", updateError);
      await captureError(updateError, { category: "upload", extra: { documentId } });
      await cleanupStorage();
      await markFailed("Die Analyse konnte nicht gespeichert werden.");
      await finalizeQuota(supabase, consumed.usageId, documentId, "failed");
      return NextResponse.json(
        { error: "Die Analyse konnte nicht gespeichert werden.", documentId },
        { status: 500 },
      );
    }

    // Originaldatei nach erfolgreicher Analyse entfernen (Privacy by Default),
    // sofern der Nutzer sie nicht ausdrücklich behalten möchte.
    if (!keepOriginal) await cleanupStorage();

    await finalizeQuota(supabase, consumed.usageId, documentId, "completed");
    return NextResponse.json({ documentId });
  } catch (err) {
    console.error("Analyse fehlgeschlagen:", err);
    await captureError(err, { category: "analysis", extra: { documentId } });
    await cleanupStorage();
    await markFailed(
      "Die automatische Analyse ist fehlgeschlagen. Bitte versuche es später erneut.",
    );
    await finalizeQuota(supabase, consumed.usageId, documentId, "failed");
    return NextResponse.json(
      {
        error:
          "Die Analyse ist fehlgeschlagen. Das Dokument wurde als fehlgeschlagen markiert.",
        documentId,
      },
      { status: 502 },
    );
  }
}
