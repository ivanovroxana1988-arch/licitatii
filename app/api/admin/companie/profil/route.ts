import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const FIELDS = [
  "denumire",
  "cui",
  "nr_reg_com",
  "sediu",
  "localitate",
  "judet",
  "iban",
  "banca",
  "reprezentant_nume",
  "reprezentant_functie",
  "reprezentant_ci_serie",
  "reprezentant_ci_numar",
  "reprezentant_ci_eliberat_de",
  "reprezentant_ci_data",
  "reprezentant_ci_valabil_pana",
  "reprezentant_validare_detalii",
  "email",
  "telefon",
  "website",
  "caen_principal",
  "caen_secundare",
  "descriere",
  "experienta_similara",
] as const;

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const { data, error } = await service
    .from("companie_profil")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profil: data ?? null });
}

export async function PUT(request: Request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Trimite datele profilului companiei." }, { status: 400 });

  const payload: Record<string, unknown> = { user_id: user?.id ?? null };
  for (const field of FIELDS) {
    payload[field] = asNullableString(body[field]);
  }
  payload.reprezentant_validat_constatator = Boolean(body.reprezentant_validat_constatator);
  payload.declaratii_json = asObject(body.declaratii_json);
  payload.documente_json = asObject(body.documente_json);

  const service = createServiceClient();
  const { data: existing, error: readError } = await service
    .from("companie_profil")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const query = existing?.id
    ? service.from("companie_profil").update(payload).eq("id", existing.id).select("*").single()
    : service.from("companie_profil").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profil: data });
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length ? clean : null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
