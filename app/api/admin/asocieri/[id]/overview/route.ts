import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteParams = { params: { id: string } };
type Company = { id: string; name: string; cui?: string | null; caen_codes?: string[] | null; cpv_codes?: string[] | null };
type Member = { company_id: string; role?: string | null; responsibility?: string | null; share_percent?: number | null; is_leader?: boolean; company?: Company | null };
type Experience = { company_id: string; value?: number | null; currency?: string | null; title?: string | null; cpv_code?: string | null; domain?: string | null };

const SELECT_FULL = "id,name,leader_company_id,purpose,notes,leader:companies!associations_leader_company_id_fkey(id,name,cui,caen_codes,cpv_codes),members:association_members(company_id,role,responsibility,share_percent,is_leader,company:companies(id,name,cui,caen_codes,cpv_codes))";

export async function GET(_request: Request, { params }: RouteParams) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data: association, error } = await service
    .from("associations")
    .select(SELECT_FULL)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!association) return NextResponse.json({ error: "Asocierea nu a fost gasita." }, { status: 404 });

  const members = ((association.members ?? []) as Member[]).filter((member) => member.company_id);
  const companyIds = members.map((member) => member.company_id);

  let experiences: Experience[] = [];
  if (companyIds.length) {
    const { data, error: experienceError } = await service
      .from("company_experience_contracts")
      .select("company_id,title,value,currency,cpv_code,domain")
      .in("company_id", companyIds);

    if (experienceError) return NextResponse.json({ error: experienceError.message }, { status: 500 });
    experiences = (data ?? []) as Experience[];
  }

  const overview = buildOverview(association, members, experiences);
  return NextResponse.json({ overview });
}

function buildOverview(association: Record<string, unknown>, members: Member[], experiences: Experience[]) {
  const caenCodes = unique(members.flatMap((member) => member.company?.caen_codes ?? []));
  const cpvCodes = unique(members.flatMap((member) => member.company?.cpv_codes ?? []));
  const totalShare = members.reduce((sum, member) => sum + (Number(member.share_percent) || 0), 0);
  const experiencesByCompany = groupExperiencesByCompany(experiences);
  const risks: string[] = [];
  const strengths: string[] = [];

  if (!association.leader_company_id) risks.push("Liderul asocierii nu este setat.");
  if (members.length < 2) risks.push("Asocierea are mai putin de doua companii.");
  if (totalShare > 0 && Math.abs(totalShare - 100) > 0.01) risks.push(`Ponderile insumeaza ${totalShare}%, nu 100%.`);
  if (!caenCodes.length) risks.push("Nu exista coduri CAEN salvate pe membrii asocierii.");
  if (!cpvCodes.length) risks.push("Nu exista coduri CPV salvate pe membrii asocierii.");
  if (!experiences.length) risks.push("Nu exista experienta similara salvata pentru membrii asocierii.");
  if (members.some((member) => !member.responsibility)) risks.push("Cel putin un membru nu are responsabilitate completata.");

  if (association.leader_company_id) strengths.push("Liderul asocierii este setat.");
  if (members.length >= 2) strengths.push("Asocierea are cel putin doi membri.");
  if (caenCodes.length) strengths.push(`${caenCodes.length} coduri CAEN agregate.`);
  if (cpvCodes.length) strengths.push(`${cpvCodes.length} coduri CPV agregate.`);
  if (experiences.length) strengths.push(`${experiences.length} contracte de experienta similara disponibile.`);

  return {
    id: association.id,
    name: association.name,
    leader_company_id: association.leader_company_id,
    purpose: association.purpose,
    notes: association.notes,
    member_count: members.length,
    total_share: totalShare,
    caen_codes: caenCodes,
    cpv_codes: cpvCodes,
    experience_count: experiences.length,
    experience_total_value: experiences.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
    strengths,
    risks,
    members: members.map((member) => {
      const companyExperiences = experiencesByCompany.get(member.company_id) ?? [];
      return {
        company_id: member.company_id,
        company_name: member.company?.name ?? member.company_id,
        cui: member.company?.cui ?? null,
        role: member.role ?? null,
        responsibility: member.responsibility ?? null,
        share_percent: Number(member.share_percent) || null,
        is_leader: Boolean(member.is_leader) || member.company_id === association.leader_company_id,
        caen_codes: member.company?.caen_codes ?? [],
        cpv_codes: member.company?.cpv_codes ?? [],
        experience_count: companyExperiences.length,
        experience_total_value: companyExperiences.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
      };
    }),
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort();
}

function groupExperiencesByCompany(experiences: Experience[]) {
  const map = new Map<string, Experience[]>();
  for (const experience of experiences) {
    if (!experience.company_id) continue;
    const current = map.get(experience.company_id) ?? [];
    current.push(experience);
    map.set(experience.company_id, current);
  }
  return map;
}
