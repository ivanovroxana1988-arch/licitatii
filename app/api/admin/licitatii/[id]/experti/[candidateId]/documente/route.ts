import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Ctx = { params: { id: string; candidateId: string } };
type UploadLike = { name?: string; type?: string; size?: number; arrayBuffer: () => Promise<ArrayBuffer> };

const BUCKET = "licitatie-experti";
const DOCUMENT_TYPES = new Set(["cv", "recomandare", "contract", "certificat_formator", "diploma", "altul"]);

export async function POST(request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const file = isUploadLike(fileValue) ? fileValue : null;
    const tip = cleanType(String(formData.get("tip") ?? "altul"));

    if (!file || Number(file.size ?? 0) <= 0) {
      return NextResponse.json({ error: "Alege un PDF pentru expert." }, { status: 400 });
    }

    const fileName = file.name || `${tip}.pdf`;
    if ((file.type && file.type !== "application/pdf") && !fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Se accepta doar PDF pentru documentele expertilor." }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: candidate, error: candidateError } = await service
      .from("licitatie_expert_candidati")
      .select("id")
      .eq("id", params.candidateId)
      .eq("licitatie_id", params.id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: candidateError?.message ?? "Candidatul nu exista in aceasta licitatie." }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeFileName = cleanFileName(fileName);
    const storagePath = `${params.id}/${params.candidateId}/${tip}/${Date.now()}-${safeFileName}`;
    const extractedText = await tryExtractPdfText(buffer);

    const { error: uploadError } = await service.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { error: insertError } = await service.from("licitatie_expert_documente").insert({
      licitatie_id: params.id,
      candidat_id: params.candidateId,
      tip,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      nume_fisier: fileName,
      mime_type: "application/pdf",
      marime_bytes: Number(file.size ?? buffer.byteLength),
      text_extras: extractedText,
    });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ ok: true, extractedChars: extractedText.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nu am putut incarca documentul expertului." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "Lipseste documentId." }, { status: 400 });

  const service = createServiceClient();
  const { data: existing, error: readError } = await service
    .from("licitatie_expert_documente")
    .select("storage_path,storage_bucket")
    .eq("id", documentId)
    .eq("licitatie_id", params.id)
    .eq("candidat_id", params.candidateId)
    .single();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  if (existing?.storage_path) {
    await service.storage.from(existing.storage_bucket || BUCKET).remove([existing.storage_path]);
  }

  const { error } = await service
    .from("licitatie_expert_documente")
    .delete()
    .eq("id", documentId)
    .eq("licitatie_id", params.id)
    .eq("candidat_id", params.candidateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function tryExtractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default ?? pdfParseModule;
    const parsed = await pdfParse(buffer);
    return String(parsed.text ?? "").trim();
  } catch {
    return "";
  }
}

function isUploadLike(value: FormDataEntryValue | null): value is UploadLike {
  return !!(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

function cleanType(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9_ -]+/g, "_").replace(/[ -]+/g, "_");
  return DOCUMENT_TYPES.has(clean) ? clean : "altul";
}

function cleanFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "document"}.pdf`;
}
