import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";
import { analyzeExpertCompatibility } from "@/lib/expert-analysis";
import type { TenderWorkspace } from "@/lib/tender-workspace";

export const runtime = "nodejs";

type Ctx = { params: { id: string; candidateId: string } };

type DocumentRow = {
  tip: string;
  nume_fisier: string;
  text_extras?: string | null;
};

export async function POST(_request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const [workspaceResult, candidateResult, documentsResult] = await Promise.all([
    service.from("licitatie_workspaces").select("brief_json").eq("licitatie_id", params.id).single(),
    service
      .from("licitatie_expert_candidati")
      .select("id,nume")
      .eq("id", params.candidateId)
      .eq("licitatie_id", params.id)
      .single(),
    service
      .from("licitatie_expert_documente")
      .select("tip,nume_fisier,text_extras")
      .eq("licitatie_id", params.id)
      .eq("candidat_id", params.candidateId),
  ]);

  if (workspaceResult.error) return NextResponse.json({ error: workspaceResult.error.message }, { status: 500 });
  if (candidateResult.error) return NextResponse.json({ error: candidateResult.error.message }, { status: 500 });
  if (documentsResult.error) return NextResponse.json({ error: documentsResult.error.message }, { status: 500 });

  const workspace = workspaceResult.data?.brief_json as TenderWorkspace | undefined;
  const roles = workspace?.experts ?? [];
  const documents = ((documentsResult.data ?? []) as DocumentRow[]) ?? [];

  if (!roles.length) {
    return NextResponse.json({ error: "Nu exista roluri de experti definite in workspace." }, { status: 400 });
  }

  if (!documents.length) {
    return NextResponse.json({ error: "Incarca macar un CV sau un document suport inainte de analiza." }, { status: 400 });
  }

  const analysis = analyzeExpertCompatibility({ roles, documents });

  const { error: updateError } = await service
    .from("licitatie_expert_candidati")
    .update({
      status: "analizat",
      scor_total: analysis.score,
      recomandare: analysis.recomandare,
      analiza_json: analysis,
      rol_tinta: analysis.bestRoleId,
    })
    .eq("id", params.candidateId)
    .eq("licitatie_id", params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ analiza: analysis });
}
