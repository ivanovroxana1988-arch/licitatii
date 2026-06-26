import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteParams = { params: { id: string } };
type MemberInput = { company_id?: unknown; role?: unknown; responsibility?: unknown; share_percent?: unknown; is_leader?: unknown };

const SELECT_FULL = "id,name,leader_company_id,purpose,notes,created_at,updated_at,leader:companies!associations_leader_company_id_fkey(id,name,cui),members:association_members(company_id,role,responsibility,share_percent,is_leader,company:companies(id,name,cui))";

export async function GET(_request: Request, { params }: RouteParams) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data, error } = await service.from("associations").select(SELECT_FULL).eq("id", params.id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Asocierea nu a fost gasita." }, { status: 404 });

  return NextResponse.json({ association: data });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Trimite datele asocierii." }, { status: 400 });

  const payload = normalizeAssociation(body);
  if (!payload.name) return NextResponse.json({ error: "Denumirea asocierii este obligatorie." }, { status: 400 });

  const members = normalizeMembers(body.members, payload.leader_company_id);
  if (!members.length) return NextResponse.json({ error: "Adauga cel putin o companie in asociere." }, { status: 400 });

  const service = createServiceClient();
  const { data: association, error } = await service.from("associations").update(payload).eq("id", params.id).select("*").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!association) return NextResponse.json({ error: "Asocierea nu a fost gasita." }, { status: 404 });

  const { error: deleteError } = await service.from("association_members").delete().eq("association_id", params.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const memberRows = members.map((member) => ({ ...member, association_id: params.id }));
  const { error: membersError } = await service.from("association_members").insert(memberRows);
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });

  const { data: full } = await service.from("associations").select(SELECT_FULL).eq("id", params.id).maybeSingle();
  return NextResponse.json({ association: full ?? association });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { error } = await service.from("associations").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ removed: true });
}

function normalizeAssociation(body: Record<string, unknown>) {
  return {
    name: asNullableString(body.name),
    leader_company_id: asNullableString(body.leader_company_id),
    purpose: asNullableString(body.purpose),
    notes: asNullableString(body.notes),
    updated_at: new Date().toISOString(),
  };
}

function normalizeMembers(value: unknown, leaderCompanyId: string | null) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows = [];

  for (const raw of value as MemberInput[]) {
    const companyId = asNullableString(raw.company_id);
    if (!companyId || seen.has(companyId)) continue;
    seen.add(companyId);

    rows.push({
      company_id: companyId,
      role: asNullableString(raw.role),
      responsibility: asNullableString(raw.responsibility),
      share_percent: asNumberOrNull(raw.share_percent),
      is_leader: Boolean(raw.is_leader) || companyId === leaderCompanyId,
    });
  }

  return rows;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length ? clean : null;
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
