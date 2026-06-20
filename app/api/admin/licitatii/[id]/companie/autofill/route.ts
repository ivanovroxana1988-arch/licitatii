import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";
import {
  buildCompanyAutofill,
  matchCompanyDocumentToDossierItem,
  type CompanyDocument,
  type CompanyProfile,
} from "@/lib/company-profile";
import { normalizeFormularConfig } from "@/lib/form-schema";
import type { TenderWorkspace } from "@/lib/tender-workspace";

type Ctx = { params: { id: string } };

const COMPANY_BUCKET = "companie-documente";
const DOSSIER_BUCKET = "licitatie-dosar-final";

export async function POST(_request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const [profileResult, documentsResult, tenderResult, workspaceResult] = await Promise.all([
    service.from("companie_profil").select("*").limit(1).maybeSingle(),
    service.from("companie_documente").select("id,tip,titlu,nume_fisier,storage_bucket,storage_path,text_extras,metadate_json"),
    service.from("licitatii").select("formular_config_json").eq("id", params.id).single(),
    service.from("licitatie_workspaces").select("brief_json").eq("licitatie_id", params.id).maybeSingle(),
  ]);

  if (profileResult.error) return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  if (documentsResult.error) return NextResponse.json({ error: documentsResult.error.message }, { status: 500 });
  if (tenderResult.error) return NextResponse.json({ error: tenderResult.error.message }, { status: 500 });

  if (!profileResult.data) {
    return NextResponse.json({ error: "Nu exista profil de companie. Completeaza-l inainte sa generezi autofill." }, { status: 400 });
  }

  const formularConfig = normalizeFormularConfig(tenderResult.data?.formular_config_json);
  const workspace = workspaceResult.data?.brief_json as TenderWorkspace | undefined;
  const documents = ((documentsResult.data ?? []) as CompanyDocument[]) ?? [];
  const result = buildCompanyAutofill({
    profile: profileResult.data as CompanyProfile,
    documents,
    formularConfig,
    workspace,
  });

  const attachedDocuments = workspace
    ? await attachCompanyDocumentsToFinalDossier({ service, licitatieId: params.id, workspace, documents })
    : [];

  if (attachedDocuments.length) {
    result.suggestions.push(`${attachedDocuments.length} documente din profilul companiei au fost atasate automat in dosarul final.`);
  }

  const { error: upsertError } = await service.from("licitatie_companie_autofill").upsert(
    {
      licitatie_id: params.id,
      profil_id: profileResult.data.id,
      valori_json: result.values,
      lipsuri_json: result.missing,
    },
    { onConflict: "licitatie_id" }
  );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({ ...result, attachedDocuments });
}

export async function GET(_request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data, error } = await service
    .from("licitatie_companie_autofill")
    .select("valori_json,lipsuri_json,updated_at")
    .eq("licitatie_id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ autofill: data ?? null });
}

async function attachCompanyDocumentsToFinalDossier(params: {
  service: ReturnType<typeof createServiceClient>;
  licitatieId: string;
  workspace: TenderWorkspace;
  documents: CompanyDocument[];
}): Promise<Array<{ title: string; fileName: string }>> {
  const attached: Array<{ title: string; fileName: string }> = [];
  const finalDocuments = [
    ...params.workspace.dossier.administrativeDocuments.map((title, index) => ({ category: "administrative", title, key: `administrative-${index + 1}-${slugify(title)}` })),
    ...params.workspace.dossier.finalChecks.map((title, index) => ({ category: "verificari-finale", title, key: `verificari-finale-${index + 1}-${slugify(title)}` })),
  ];

  for (const item of finalDocuments) {
    const companyDoc = matchCompanyDocumentToDossierItem(item.title, params.documents);
    if (!companyDoc?.storage_path) continue;

    const safeName = cleanFileName(companyDoc.nume_fisier || `${item.key}.pdf`);
    const targetPath = `${params.licitatieId}/${item.key}/${Date.now()}-${safeName}`;
    const sourceBucket = companyDoc.storage_bucket || COMPANY_BUCKET;

    const { data: existing } = await params.service
      .from("licitatie_dosar_documente")
      .select("storage_path,storage_bucket")
      .eq("licitatie_id", params.licitatieId)
      .eq("document_key", item.key)
      .maybeSingle();

    const { error: copyError } = await params.service.storage.from(sourceBucket).copy(companyDoc.storage_path, targetPath, {
      destinationBucket: DOSSIER_BUCKET,
    });

    if (copyError) continue;

    const { error: upsertError } = await params.service.from("licitatie_dosar_documente").upsert(
      {
        licitatie_id: params.licitatieId,
        document_key: item.key,
        categorie: item.category,
        titlu: item.title,
        storage_bucket: DOSSIER_BUCKET,
        storage_path: targetPath,
        nume_fisier: companyDoc.nume_fisier,
        mime_type: "application/pdf",
        marime_bytes: null,
        incarcat_la: new Date().toISOString(),
      },
      { onConflict: "licitatie_id,document_key" }
    );

    if (!upsertError) {
      if (existing?.storage_path) {
        await params.service.storage.from(existing.storage_bucket || DOSSIER_BUCKET).remove([existing.storage_path]);
      }
      attached.push({ title: item.title, fileName: companyDoc.nume_fisier });
    }
  }

  return attached;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanFileName(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "document"}.pdf`;
}
