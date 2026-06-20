import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";
import { buildCompanyAutofill, type CompanyProfile } from "@/lib/company-profile";
import { normalizeFormularConfig } from "@/lib/form-schema";
import type { TenderWorkspace } from "@/lib/tender-workspace";

type Ctx = { params: { id: string } };

export async function POST(_request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const [profileResult, tenderResult, workspaceResult] = await Promise.all([
    service.from("companie_profil").select("*").limit(1).maybeSingle(),
    service.from("licitatii").select("formular_config_json").eq("id", params.id).single(),
    service.from("licitatie_workspaces").select("brief_json").eq("licitatie_id", params.id).maybeSingle(),
  ]);

  if (profileResult.error) return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  if (tenderResult.error) return NextResponse.json({ error: tenderResult.error.message }, { status: 500 });

  if (!profileResult.data) {
    return NextResponse.json({ error: "Nu exista profil de companie. Completeaza-l inainte sa generezi autofill." }, { status: 400 });
  }

  const formularConfig = normalizeFormularConfig(tenderResult.data?.formular_config_json);
  const workspace = workspaceResult.data?.brief_json as TenderWorkspace | undefined;
  const result = buildCompanyAutofill({
    profile: profileResult.data as CompanyProfile,
    formularConfig,
    workspace,
  });

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

  return NextResponse.json(result);
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
