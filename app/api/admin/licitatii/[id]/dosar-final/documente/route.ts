import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const BUCKET = "licitatie-dosar-final";

type Ctx = { params: { id: string } };

type DossierDocumentRow = {
  id: string;
  licitatie_id: string;
  document_key: string;
  categorie: string;
  titlu: string;
  storage_bucket: string;
  storage_path: string;
  nume_fisier: string;
  mime_type: string;
  marime_bytes: number | null;
  incarcat_la: string;
};

export async function GET(_request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data, error } = await service
    .from("licitatie_dosar_documente")
    .select("id,licitatie_id,document_key,categorie,titlu,storage_bucket,storage_path,nume_fisier,mime_type,marime_bytes,incarcat_la")
    .eq("licitatie_id", params.id)
    .order("incarcat_la", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as DossierDocumentRow[]).map(async (row) => {
    const { data: signed } = await service.storage
      .from(row.storage_bucket || BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60);

    return {
      ...row,
      signed_url: signed?.signedUrl ?? null,
    };
  });

  return NextResponse.json({ documente: await Promise.all(rows) });
}

export async function POST(request: Request, { params }: Ctx) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    const file = isUploadLike(fileValue) ? fileValue : null;
    const documentKey = cleanKey(String(formData.get("documentKey") ?? ""));
    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "dosar-final").trim();

    if (!file || Number(file.size ?? 0) <= 0) {
      return NextResponse.json({ error: "Alege un fisier PDF pentru incarcare." }, { status: 400 });
    }

    if (!documentKey || !title) {
      return NextResponse.json({ error: "Lipsesc documentKey sau title. Fara eticheta, fisierul devine haos cu extensie .pdf." }, { status: 400 });
    }

    const mime = file.type || "application/pdf";
    const fileName = file.name || `${documentKey}.pdf`;
    if (mime !== "application/pdf" && !fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Se accepta doar documente PDF." }, { status: 400 });
    }

    const service = createServiceClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeFileName = cleanFileName(fileName);
    const storagePath = `${params.id}/${documentKey}/${Date.now()}-${safeFileName}`;

    const { data: existing } = await service
      .from("licitatie_dosar_documente")
      .select("storage_path,storage_bucket")
      .eq("licitatie_id", params.id)
      .eq("document_key", documentKey)
      .maybeSingle();

    const { error: uploadError } = await service.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { error: upsertError } = await service.from("licitatie_dosar_documente").upsert(
      {
        licitatie_id: params.id,
        document_key: documentKey,
        categorie: category,
        titlu: title,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        nume_fisier: fileName,
        mime_type: "application/pdf",
        marime_bytes: Number(file.size ?? buffer.byteLength),
        incarcat_de: user?.id ?? null,
        incarcat_la: new Date().toISOString(),
      },
      { onConflict: "licitatie_id,document_key" }
    );

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    if (existing?.storage_path) {
      await service.storage.from(existing.storage_bucket || BUCKET).remove([existing.storage_path]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nu am putut incarca documentul. PDF-ul a ales sa aiba personalitate." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const documentKey = cleanKey(new URL(request.url).searchParams.get("documentKey") ?? "");
  if (!documentKey) return NextResponse.json({ error: "Lipseste documentKey." }, { status: 400 });

  const service = createServiceClient();
  const { data: existing, error: readError } = await service
    .from("licitatie_dosar_documente")
    .select("storage_path,storage_bucket")
    .eq("licitatie_id", params.id)
    .eq("document_key", documentKey)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  if (existing?.storage_path) {
    await service.storage.from(existing.storage_bucket || BUCKET).remove([existing.storage_path]);
  }

  const { error } = await service
    .from("licitatie_dosar_documente")
    .delete()
    .eq("licitatie_id", params.id)
    .eq("document_key", documentKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

type UploadLike = {
  name?: string;
  type?: string;
  size?: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isUploadLike(value: unknown): value is UploadLike {
  return !!(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

function cleanKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function cleanFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "document"}.pdf`;
}
