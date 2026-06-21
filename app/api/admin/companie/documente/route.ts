import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";
import { inferCompanyProfilePatchFromDocument, type CompanyProfile } from "@/lib/company-profile";

export const runtime = "nodejs";

type UploadLike = { name?: string; type?: string; size?: number; arrayBuffer: () => Promise<ArrayBuffer> };

type CompanyDocumentRow = {
  id: string;
  tip: string;
  titlu: string;
  storage_bucket: string;
  storage_path: string;
  nume_fisier: string;
  mime_type: string;
  marime_bytes: number | null;
  text_extras: string | null;
  metadate_json: Record<string, unknown> | null;
  incarcat_la: string;
};

const BUCKET = "companie-documente";
const TYPES = new Set(["certificat_constatator", "certificat_fiscal", "certificat_beneficiar_real", "imputernicire", "contract_similar", "recomandare", "altul"]);

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data, error } = await service
    .from("companie_documente")
    .select("id,tip,titlu,storage_bucket,storage_path,nume_fisier,mime_type,marime_bytes,text_extras,metadate_json,incarcat_la")
    .order("incarcat_la", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const documente = await Promise.all(((data ?? []) as CompanyDocumentRow[]).map(async (doc) => {
    const { data: signed } = await service.storage.from(doc.storage_bucket || BUCKET).createSignedUrl(doc.storage_path, 60 * 60);
    return { ...doc, signed_url: signed?.signedUrl ?? null };
  }));

  return NextResponse.json({ documente });
}

export async function POST(request: Request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const file = isUploadLike(fileValue) ? fileValue : null;
    const tip = cleanType(String(formData.get("tip") ?? "altul"));
    const titlu = String(formData.get("titlu") ?? labelForType(tip)).trim() || labelForType(tip);
    const browserOcrText = String(formData.get("extractedText") ?? "").replace(/\n{3,}/g, "\n\n").trim();

    if (!file || Number(file.size ?? 0) <= 0) {
      return NextResponse.json({ error: "Alege un PDF pentru documentul companiei." }, { status: 400 });
    }

    const fileName = file.name || `${tip}.pdf`;
    if ((file.type && file.type !== "application/pdf") && !fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Se accepta doar PDF pentru documentele companiei." }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: profile, error: profileError } = await service
      .from("companie_profil")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    let profileId = profile?.id as string | undefined;
    let currentProfile = (profile ?? {}) as CompanyProfile;

    if (!profileId) {
      const { data: created, error: createError } = await service
        .from("companie_profil")
        .insert({ user_id: user?.id ?? null })
        .select("*")
        .single();
      if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
      profileId = created.id;
      currentProfile = created as CompanyProfile;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const serverText = await tryExtractPdfText(buffer);
    const text = browserOcrText.length > serverText.length ? browserOcrText : serverText;
    const extractionSource = browserOcrText.length > serverText.length ? "browser-ocr" : "pdf-parse";
    const safeFileName = cleanFileName(fileName);
    const storagePath = `${profileId}/${tip}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await service.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const metadata = inferCompanyProfilePatchFromDocument({ tip, text, currentProfile });

    const { error: insertError } = await service.from("companie_documente").insert({
      profil_id: profileId,
      tip,
      titlu,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      nume_fisier: fileName,
      mime_type: "application/pdf",
      marime_bytes: Number(file.size ?? buffer.byteLength),
      text_extras: text,
      metadate_json: {
        extractedProfilePatch: metadata,
        extractionSource,
        serverTextChars: serverText.length,
        browserOcrChars: browserOcrText.length,
      },
    });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const documentFlags = {
      ...((currentProfile.documente_json as Record<string, unknown>) ?? {}),
      [tip]: true,
    };

    const profilePatch = {
      ...metadata,
      documente_json: documentFlags,
    };

    const { data: updatedProfile, error: updateError } = await service
      .from("companie_profil")
      .update(profilePatch)
      .eq("id", profileId)
      .select("*")
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, extractedChars: text.length, extractionSource, profil: updatedProfile, extractedProfilePatch: metadata });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nu am putut incarca documentul companiei." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "Lipseste documentId." }, { status: 400 });

  const service = createServiceClient();
  const { data: existing, error: readError } = await service
    .from("companie_documente")
    .select("storage_path,storage_bucket")
    .eq("id", documentId)
    .single();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  if (existing?.storage_path) {
    await service.storage.from(existing.storage_bucket || BUCKET).remove([existing.storage_path]);
  }

  const { error } = await service.from("companie_documente").delete().eq("id", documentId);
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

function isUploadLike(value: unknown): value is UploadLike {
  return !!(value && typeof value === "object" && "arrayBuffer" in value && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function");
}

function cleanType(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9_ -]+/g, "_").replace(/[ -]+/g, "_");
  return TYPES.has(clean) ? clean : "altul";
}

function cleanFileName(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "document"}.pdf`;
}

function labelForType(value: string): string {
  const labels: Record<string, string> = {
    certificat_constatator: "Certificat constatator ONRC",
    certificat_fiscal: "Certificat fiscal",
    certificat_beneficiar_real: "Dovada beneficiar real",
    imputernicire: "Imputernicire semnatar",
    contract_similar: "Contract similar",
    recomandare: "Recomandare",
    altul: "Alt document",
  };
  return labels[value] ?? "Alt document";
}
