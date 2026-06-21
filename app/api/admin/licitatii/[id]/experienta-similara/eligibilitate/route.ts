import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";
import { analyzeEligibility, type SimilarContract } from "@/lib/similar-experience";
import type { TenderWorkspace } from "@/lib/tender-workspace";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const [contractsResult, workspaceResult, tenderResult] = await Promise.all([
    service.from("experienta_similara_contracte").select("*"),
    service.from("licitatie_workspaces").select("brief_json").eq("licitatie_id", params.id).maybeSingle(),
    service.from("licitatii").select("id,nume").eq("id", params.id).maybeSingle(),
  ]);

  if (contractsResult.error) return NextResponse.json({ error: contractsResult.error.message }, { status: 500 });
  if (workspaceResult.error) return NextResponse.json({ error: workspaceResult.error.message }, { status: 500 });

  const workspace = workspaceResult.data?.brief_json as TenderWorkspace | undefined;
  const analysis = analyzeEligibility({
    contracts: (contractsResult.data ?? []) as SimilarContract[],
    workspace,
    maxContracts: 3,
    yearsBack: 3,
  });

  return NextResponse.json({ licitatie: tenderResult.data ?? null, analysis });
}
