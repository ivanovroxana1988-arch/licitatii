import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";
import { inferSimilarContractFromText } from "@/lib/similar-experience";

export const runtime = "nodejs";

type UploadLike = { name?: string; type?: string; size?: number; arrayBuffer: () => Promise<ArrayBuffer> };

const BUCKET = "experienta-similara";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data, error } = await service
    .from("experienta_similara_contracte")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contracte = await Promise.all((data ?? []).map(async (row) => {
    if (!row.storage_path) return row;
    const { data: signed } = await service.storage.from(row.storage_bucket || BUCKET).createSignedUrl(row.storage_path, 60 * 60);
    return { ...row, signed_url: signed?.signedUrl ?? null };
  }));

  return NextResponse.json({ contracte });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const file = isUploadLike(fileValue) ? fileValue : null;
    const manualText = String(formData.get("extractedText") ?? "").trim();

    if (!file || Number(file.size ?? 0) <= 0) {
      return NextResponse.json({ error: "Incarca PDF-ul contractului sau recomandarii." }, { status: 400 });
    }

    const fileName = file.name || "contract.pdf";
    if ((file.type && file.type !== "application/pdf") && !fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Se accepta doar PDF." }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: profile } = await service.from("companie_profil").select("id").limit(1).maybeSingle();

    const buffer = Buffer.from(await file.arrayBuffer());
    const serverText = await tryExtractPdfText(buffer);
    const text = manualText.length > serverText.length ? manualText : serverText;
    const inferred = inferSimilarContractFromText(text, fileName.replace(/\.pdf$/i, ""));
    const storagePath = `${profile?.id ?? "global"}/${Date.now()}-${cleanFileName(fileName)}`;

    const { error: uploadError } = await service.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data, error } = await service
      .from("experienta_similara_contracte")
      .insert({
        profil_id: profile?.id ?? null,
        titlu: inferred.titlu ?? fileName,
        beneficiar: inferred.beneficiar ?? null,
        obiect: inferred.obiect ?? null,
        valoare_fara_tva: inferred.valoare_fara_tva ?? null,
        moneda: inferred.moneda ?? "RON",
        data_contract: inferred.data_contract ?? null,
        data_finalizare: inferred.data_finalizare ?? null,
        domenii_text: inferred.domenii_text ?? null,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        nume_fisier: fileName,
        marime_bytes: Number(file.size ?? buffer.byteLength),
        text_extras: text,
        analiza_json: { extractionSource: manualText.length > serverText.length ? "browser-ocr" : "pdf-parse", serverTextChars: serverText.length, browserTextChars: manualText.length },
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contract: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Nu am putut incarca experienta similara." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.id) return NextResponse.json({ error: "Lipseste id contract." }, { status: 400 });

  const payload = {
    titlu: asString(body.titlu),
    beneficiar: asString(body.beneficiar),
    obiect: asString(body.obiect),
    valoare_fara_tva: asNumber(body.valoare_fara_tva),
    moneda: asString(body.moneda) || "RON",
    data_contract: asString(body.data_contract),
    data_finalizare: asString(body.data_finalizare),
    domenii_text: asString(body.domenii_text),
  };

  const service = createServiceClient();
  const { data, error } = await service
    .from("experienta_similara_contracte")
    .update(payload)
    .eq("id", String(body.id))
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

export async function DELETE(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Lipseste id." }, { status: 400 });

  const service = createServiceClient();
  const { data: existing } = await service.from("experienta_similara_contracte").select("storage_path,storage_bucket").eq("id", id).maybeSingle();
  if (existing?.storage_path) await service.storage.from(existing.storage_bucket || BUCKET).remove([existing.storage_path]);
  const { error } = await service.from("experienta_similara_contracte").delete().eq("id", id);
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

function cleanFileName(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "contract"}.pdf`;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(/[ ._]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
