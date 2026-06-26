import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";
import { buildTenderMatch, type CandidateKind, type MatchInput } from "@/lib/matching/tender-match";

export const runtime = "nodejs";

type MatchBody = { tenderId?: string; candidateKind?: CandidateKind; candidateId?: string };
type Company = { id: string; name: string; cui?: string | null; caen_codes?: string[] | null; cpv_codes?: string[] | null };
type Member = { company_id: string; responsibility?: string | null; share_percent?: number | null; is_leader?: boolean; company?: Company | null };
type Experience = { title?: string | null; domain?: string | null; cpv_code?: string | null; value?: number | null };
type CandidateLoadResult =
  | { ok: true; status: 200; value: MatchInput["candidate"] }
  | { ok: false; status: number; error: string };

const ASSOCIATION_SELECT = "id,name,leader_company_id,purpose,notes,members:association_members(company_id,role,responsibility,share_percent,is_leader,company:companies(id,name,cui,caen_codes,cpv_codes))";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const [tendersResult, companiesResult, associationsResult] = await Promise.all([
    service.from("licitatii").select("id,nume,referinta,beneficiar,status").order("creat_la", { ascending: false }),
    service.from("companies").select("id,name,cui,caen_codes,cpv_codes").order("created_at", { ascending: false }),
    service.from("associations").select(ASSOCIATION_SELECT).order("created_at", { ascending: false }),
  ]);

  const error = tendersResult.error ?? companiesResult.error ?? associationsResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    tenders: tendersResult.data ?? [],
    companies: companiesResult.data ?? [],
    associations: associationsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as MatchBody | null;
  if (!body?.tenderId || !body?.candidateKind || !body?.candidateId) {
    return NextResponse.json({ error: "Alege licitatia si candidatul." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: tender, error: tenderError } = await service
    .from("licitatii")
    .select("id,nume,referinta,beneficiar,status")
    .eq("id", body.tenderId)
    .maybeSingle();

  if (tenderError) return NextResponse.json({ error: tenderError.message }, { status: 500 });
  if (!tender) return NextResponse.json({ error: "Licitatia nu a fost gasita." }, { status: 404 });

  const candidate = body.candidateKind === "association"
    ? await loadAssociationCandidate(service, body.candidateId)
    : await loadCompanyCandidate(service, body.candidateId);

  if (!candidate.ok) return NextResponse.json({ error: candidate.error }, { status: candidate.status });

  const result = buildTenderMatch({ tender, candidate: candidate.value });

  const { data: saved, error: saveError } = await service
    .from("tender_company_matches")
    .insert({
      tender_id: body.tenderId,
      company_id: body.candidateKind === "company" ? body.candidateId : null,
      association_id: body.candidateKind === "association" ? body.candidateId : null,
      scores: result.scores,
      risks: { warnings: result.warnings, strengths: result.strengths, evidence: result.evidence },
      recommendation: result.recommendation,
    })
    .select("*")
    .single();

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  return NextResponse.json({ match: saved, result });
}

async function loadCompanyCandidate(service: ReturnType<typeof createServiceClient>, companyId: string): Promise<CandidateLoadResult> {
  const { data: company, error } = await service.from("companies").select("id,name,cui,caen_codes,cpv_codes").eq("id", companyId).maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!company) return { ok: false, error: "Compania nu a fost gasita.", status: 404 };

  const { data: experiences, error: expError } = await service.from("company_experience_contracts").select("title,domain,cpv_code,value").eq("company_id", companyId);
  if (expError) return { ok: false, error: expError.message, status: 500 };

  return {
    ok: true,
    status: 200,
    value: {
      kind: "company",
      id: company.id,
      name: company.name,
      caenCodes: company.caen_codes ?? [],
      cpvCodes: company.cpv_codes ?? [],
      experiences: (experiences ?? []) as Experience[],
    },
  };
}

async function loadAssociationCandidate(service: ReturnType<typeof createServiceClient>, associationId: string): Promise<CandidateLoadResult> {
  const { data: association, error } = await service.from("associations").select(ASSOCIATION_SELECT).eq("id", associationId).maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!association) return { ok: false, error: "Asocierea nu a fost gasita.", status: 404 };

  const members = ((association.members ?? []) as Member[]).filter((member) => member.company_id);
  const companyIds = members.map((member) => member.company_id);
  const { data: experiences, error: expError } = companyIds.length
    ? await service.from("company_experience_contracts").select("title,domain,cpv_code,value").in("company_id", companyIds)
    : { data: [] as Experience[], error: null };

  if (expError) return { ok: false, error: expError.message, status: 500 };

  return {
    ok: true,
    status: 200,
    value: {
      kind: "association",
      id: association.id,
      name: association.name,
      caenCodes: unique(members.flatMap((member) => member.company?.caen_codes ?? [])),
      cpvCodes: unique(members.flatMap((member) => member.company?.cpv_codes ?? [])),
      experiences: (experiences ?? []) as Experience[],
      memberCount: members.length,
      totalShare: members.reduce((sum, member) => sum + (Number(member.share_percent) || 0), 0),
      hasLeader: Boolean(association.leader_company_id),
      missingResponsibilities: members.filter((member) => !member.responsibility).length,
    },
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort();
}
