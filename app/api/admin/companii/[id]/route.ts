import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteParams = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data, error } = await service.from("companies").select("*").eq("id", params.id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Compania nu a fost gasita." }, { status: 404 });

  return NextResponse.json({ company: data });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Trimite datele companiei." }, { status: 400 });

  const payload = normalizeCompanyPayload(body);
  if (!payload.name) return NextResponse.json({ error: "Denumirea companiei este obligatorie." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.from("companies").update(payload).eq("id", params.id).select("*").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Compania nu a fost gasita." }, { status: 404 });

  return NextResponse.json({ company: data });
}

function normalizeCompanyPayload(body: Record<string, unknown>) {
  return {
    name: asNullableString(body.name),
    cui: asNullableString(body.cui),
    registration_no: asNullableString(body.registration_no),
    legal_form: asNullableString(body.legal_form),
    address: asNullableString(body.address),
    representative_name: asNullableString(body.representative_name),
    representative_role: asNullableString(body.representative_role),
    email: asNullableString(body.email),
    phone: asNullableString(body.phone),
    website: asNullableString(body.website),
    notes: asNullableString(body.notes),
    caen_codes: asStringArray(body.caen_codes),
    cpv_codes: asStringArray(body.cpv_codes),
    updated_at: new Date().toISOString(),
  };
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length ? clean : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
}
