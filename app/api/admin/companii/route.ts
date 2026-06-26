import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const COMPANY_FIELDS = [
  "name",
  "cui",
  "registration_no",
  "legal_form",
  "address",
  "representative_name",
  "representative_role",
  "email",
  "phone",
  "website",
  "notes",
] as const;

export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const service = createServiceClient();

  let query = service
    .from("companies")
    .select("id,name,cui,registration_no,legal_form,address,representative_name,representative_role,email,phone,website,caen_codes,cpv_codes,notes,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${escapeIlike(search)}%,cui.ilike.%${escapeIlike(search)}%,registration_no.ilike.%${escapeIlike(search)}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ companies: data ?? [] });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Trimite datele companiei." }, { status: 400 });

  const payload = normalizeCompanyPayload(body);
  if (!payload.name) return NextResponse.json({ error: "Denumirea companiei este obligatorie." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("companies")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ company: data }, { status: 201 });
}

function normalizeCompanyPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  for (const field of COMPANY_FIELDS) {
    payload[field] = asNullableString(body[field]);
  }

  payload.caen_codes = asStringArray(body.caen_codes);
  payload.cpv_codes = asStringArray(body.cpv_codes);
  payload.updated_at = new Date().toISOString();

  return payload;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length ? clean : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, "");
}
