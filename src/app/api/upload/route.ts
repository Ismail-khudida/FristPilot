import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeDocuments, type AnalyzeInput } from "@/lib/ai";
import { detectFileType, isAllowedOrigin, type DetectedFileType } from "@/lib/upload";
import {
  checkQuota,
  consumeQuota,
  finalizeQuota,
  quotaMessage,
} from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB pro Seite
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB gesamt
const MAX_PAGES = 12;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

// Ab dieser Confidence wird eine datierte Frist automatisch (Opt-in) als
// Erinnerung angelegt. Bewusst vorsichtig: nur klar erkannte Fristen, damit
// keine zweifelhaften Erinnerungen entstehen.
const AUTO_REMINDER_MIN_CONFIDENCE = 0.7;

interface PreparedPage {
  buffer: Buffer;
  detected: DetectedFileType;
  name: string;
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "Bitte mindestens eine Datei auswählen." },
      { status: 400 },
    );
  }
  if (files.length > MAX_PAGES) {
    return NextResponse.json(
      { error: `Bitte höchstens ${MAX_PAGES} Bilder auf einmal hochladen.` },
      { status: 400 },
    );
  }

  const keepOriginal = formData.get("keep_original") === "true";
  // Auto-Erinnerung ist standardmäßig an; der Nutzer kann sie pro Upload abwählen.
  const autoReminders = formData.get("auto_reminders") !== "false";

  // Alle Dateien lesen und ihren echten Typ über die Magic Bytes bestimmen.
  const pages: PreparedPage[] = [];
  let totalBytes = 0;
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Eine Datei ist zu groß (max. 10 MB pro Datei)." },
        { status: 400 },
      );
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Die Dateien sind insgesamt zu groß (max. 25 MB)." },
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
    pages.push({ buffer, detected, name: file.name });
  }

  // PDF ist bereits mehrseitig -> nur einzeln. Mehrere Dateien nur als Bilder.
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

  // Rate-Limit prüfen und EINE Analyse-Einheit buchen (ein Claude-Aufruf,
  // unabhängig davon, ob daraus ein oder mehrere Dokumente entstehen).
  const quota = await checkQuota(supabase);
  if (!quota.allowed) {
    return NextResponse.json({ error: quotaMessage(quota.reason) }, { status: 429 });
  }
  const consumed = await consumeQuota(supabase);
  if (!consumed.allowed) {
    return NextResponse.json({ error: quotaMessage(consumed.reason) }, { status: 429 });
  }

  // Analyse + Gruppierung. Mehrere Bilder können ein oder mehrere Dokumente
  // ergeben; ein einzelnes Bild/PDF ergibt genau ein Dokument.
  let analyzed;
  try {
    const input: AnalyzeInput[] = pages.map((p) => ({
      data: p.buffer,
      mimeType: p.detected.mime,
    }));
    analyzed = await analyzeDocuments(input);
  } catch (err) {
    console.error("Analyse fehlgeschlagen:", err);
    await captureError(err, { category: "analysis" });
    await finalizeQuota(supabase, consumed.usageId, null, "failed");
    return NextResponse.json(
      { error: "Die Analyse ist fehlgeschlagen. Bitte versuche es später erneut." },
      { status: 502 },
    );
  }

  // Pro erkanntem Dokument eine Zeile anlegen (und – bei Opt-in – seine Seiten
  // speichern). Reihenfolge der Seiten bleibt durch pageIndices erhalten.
  const createdIds: string[] = [];
  let reminderCount = 0;
  for (const doc of analyzed) {
    const groupPages = doc.pageIndices
      .map((i) => pages[i - 1])
      .filter((p): p is PreparedPage => Boolean(p));
    if (groupPages.length === 0) continue;

    const displayName =
      doc.analysis.suggested_title?.trim() || groupPages[0].name;

    const { data: created, error: createError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        file_name: displayName,
        file_type: groupPages[0].detected.mime,
        status: "processing",
        page_count: groupPages.length,
      })
      .select("id")
      .single();
    if (createError || !created) {
      console.error("Dokument konnte nicht angelegt werden:", createError);
      continue;
    }
    const documentId = created.id as string;

    // Originalseiten nur bei Opt-in im Storage ablegen.
    let storedPaths: string[] | null = null;
    if (keepOriginal) {
      const paths: string[] = [];
      let ok = true;
      for (let i = 0; i < groupPages.length; i++) {
        const path = `${user.id}/${documentId}/p${i + 1}.${groupPages[i].detected.ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, groupPages[i].buffer, {
            contentType: groupPages[i].detected.mime,
            upsert: false,
          });
        if (upErr) {
          console.error("Seite konnte nicht gespeichert werden:", upErr);
          ok = false;
          break;
        }
        paths.push(path);
      }
      storedPaths = ok ? paths : null;
      if (!ok) {
        // Teilweise hochgeladene Seiten wieder entfernen.
        await supabase.storage.from(BUCKET).remove(paths);
      }
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        file_url: storedPaths ? storedPaths[0] : null,
        file_urls: storedPaths,
        extracted_text: null,
        analysis_json: doc.analysis,
        category: doc.analysis.category ?? "sonstiges",
        status: "done",
        analysis_error: null,
      })
      .eq("id", documentId)
      .eq("user_id", user.id);
    if (updateError) {
      console.error("Analyse konnte nicht gespeichert werden:", updateError);
      await supabase
        .from("documents")
        .update({ status: "failed", analysis_error: "Speichern fehlgeschlagen." })
        .eq("id", documentId)
        .eq("user_id", user.id);
      continue;
    }
    createdIds.push(documentId);

    // Auto-Erinnerung: nur datierte Fristen mit ausreichender Confidence.
    // Die vorsichtige Sprache bleibt erhalten ("Mögliche Frist …").
    if (autoReminders) {
      const reminderRows = doc.analysis.deadlines
        .filter((d) => d.date && d.confidence >= AUTO_REMINDER_MIN_CONFIDENCE)
        .map((d) => ({
          user_id: user.id,
          document_id: documentId,
          title:
            d.required_action?.trim() ||
            d.description?.trim() ||
            `Mögliche Frist: ${displayName}`,
          description: d.description?.trim() || null,
          due_date: d.date,
          status: "open",
        }));
      if (reminderRows.length > 0) {
        const { error: remErr } = await supabase
          .from("reminders")
          .insert(reminderRows);
        if (remErr) {
          console.error("Auto-Erinnerungen konnten nicht angelegt werden:", remErr);
        } else {
          reminderCount += reminderRows.length;
        }
      }
    }
  }

  if (createdIds.length === 0) {
    await finalizeQuota(supabase, consumed.usageId, null, "failed");
    return NextResponse.json(
      { error: "Die Dokumente konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }

  await finalizeQuota(supabase, consumed.usageId, createdIds[0], "completed");
  return NextResponse.json({
    documentId: createdIds[0],
    documentCount: createdIds.length,
    reminderCount,
  });
}
