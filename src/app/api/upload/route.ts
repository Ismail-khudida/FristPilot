import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeDocument, type AnalyzeInput } from "@/lib/ai";
import { detectFileType, isAllowedOrigin, type DetectedFileType } from "@/lib/upload";
import {
  checkQuota,
  consumeQuota,
  finalizeQuota,
  quotaMessage,
} from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";

// KI-Analyse kann einige Sekunden dauern.
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB pro Seite
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB gesamt
const MAX_PAGES = 12; // mehrere Bilder pro Dokument
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

interface PreparedPage {
  buffer: Buffer;
  detected: DetectedFileType;
}

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

  // Mehrere Dateien (Seiten) werden alle unter dem Feld "file" gesendet.
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "Bitte mindestens eine Datei auswählen." },
      { status: 400 },
    );
  }
  if (files.length > MAX_PAGES) {
    return NextResponse.json(
      { error: `Bitte höchstens ${MAX_PAGES} Seiten auf einmal hochladen.` },
      { status: 400 },
    );
  }

  // Opt-in: Originale nach der Analyse behalten (Standard: löschen).
  const keepOriginal = formData.get("keep_original") === "true";

  // 4. Jede Seite lesen und ihren echten Typ über die Magic Bytes bestimmen.
  const pages: PreparedPage[] = [];
  let totalBytes = 0;
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Eine Seite ist zu groß (max. 10 MB pro Datei)." },
        { status: 400 },
      );
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Die Dokumente sind insgesamt zu groß (max. 25 MB)." },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectFileType(buffer);
    if (!detected) {
      return NextResponse.json(
        { error: "Nur echte PDF-, JPG- oder PNG-Dateien werden unterstützt." },
        { status: 400 },
      );
    }
    pages.push({ buffer, detected });
  }

  // Regel: Ein PDF ist bereits mehrseitig und wird einzeln verarbeitet. Mehrere
  // Seiten sind nur als Bilder erlaubt (kein Mischen von PDF und Bildern).
  const hasPdf = pages.some((p) => p.detected.mime === "application/pdf");
  if (hasPdf && pages.length > 1) {
    return NextResponse.json(
      {
        error:
          "PDF-Dateien sind bereits mehrseitig – bitte einzeln hochladen. Für mehrere Fotos lade Bilder (JPG/PNG) hoch.",
      },
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

  // 6. Dokumentzeile zuerst anlegen (status='processing').
  const { data: created, error: createError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      file_name: files[0].name,
      file_type: pages[0].detected.mime,
      status: "processing",
      page_count: pages.length,
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
  // Seitenpfade liegen in einem Unterordner pro Dokument, nummeriert in
  // Reihenfolge: <user>/<doc>/p1.jpg, p2.jpg …
  const storagePaths = pages.map(
    (p, i) => `${user.id}/${documentId}/p${i + 1}.${p.detected.ext}`,
  );

  const cleanupStorage = async () => {
    const { error } = await supabase.storage.from(BUCKET).remove(storagePaths);
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
      .update({ status: "failed", analysis_error: message, file_url: null, file_urls: null })
      .eq("id", documentId)
      .eq("user_id", user.id);
    if (error) console.error("Status 'failed' konnte nicht gesetzt werden:", error);
  };

  // 7. Alle Seiten in den Storage legen (session-gebundener Client, RLS schützt
  //    den user_id/...-Ordner).
  for (let i = 0; i < pages.length; i++) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePaths[i], pages[i].buffer, {
        contentType: pages[i].detected.mime,
        upsert: false,
      });
    if (uploadError) {
      console.error("Upload fehlgeschlagen:", uploadError);
      await captureError(uploadError, { category: "storage", extra: { documentId } });
      await cleanupStorage();
      await markFailed("Die Datei konnte nicht gespeichert werden.");
      return NextResponse.json(
        { error: "Die Datei konnte nicht gespeichert werden.", documentId },
        { status: 500 },
      );
    }
  }

  // 8. Verbrauch buchen, unmittelbar vor dem Claude-Aufruf.
  const consumed = await consumeQuota(supabase);
  if (!consumed.allowed) {
    await cleanupStorage();
    await deleteDocumentRow();
    return NextResponse.json(
      { error: quotaMessage(consumed.reason) },
      { status: 429 },
    );
  }

  // 9. Analyse über ALLE Seiten gemeinsam.
  try {
    const analysisInput: AnalyzeInput[] = pages.map((p) => ({
      data: p.buffer,
      mimeType: p.detected.mime,
    }));
    const analysis = await analyzeDocument(analysisInput);

    // Datenschutz-by-Default: nur das strukturierte Ergebnis bleibt; die
    // Originalseiten werden nach der Analyse gelöscht – außer der Nutzer hat
    // "Original behalten" gewählt.
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        file_url: keepOriginal ? storagePaths[0] : null,
        file_urls: keepOriginal ? storagePaths : null,
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
