import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

const BUCKET = "licitatie-experti";

type ExpertDocumentRow = {
  id: string;
  candidat_id: string;
  tip: string;
  storage_bucket: string;
  storage_path: string;
  nume_fisier: string;
  mime_type: string;
  marime_bytes: number | null;
  incarcat_la: string;
};

type CandidateRow = {
  id: string;
  licitatie_id: string;
  nume: string;
  email: string | null;
  telefon: string | null;
  rol_tinta: string | null;
  status: string;
  scor_total: number;
  recomandare: string | null;
  analiza_json: Record<string, unknown> | null;
  creat_la: string;
  documente?: ExpertDocumentRow[];
};

export async function GET(_request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const service = createServiceClient();
  const [candidatesResult, allocationsResult] = await Promise.all([
    service
      .from("licitatie_expert_candidati")
      .select("id,licitatie_id,nume,email,telefon,rol_tinta,status,scor_total,recomandare,analiza_json,creat_la,documente:licitatie_expert_documente(id,candidat_id,tip,storage_bucket,storage_path,nume_fisier,mime_type,marime_bytes,incarcat_la)")
      .eq("licitatie_id", params.id)
      .order("creat_la", { ascending: false }),
    service
      .from("licitatie_expert_alocari")
      .select("id,licitatie_id,role_id,role_title,candidat_id,status,validated_at,updated_at")
      .eq("licitatie_id", params.id),
  ]);

  if (candidatesResult.error) return NextResponse.json({ error: candidatesResult.error.message }, { status: 500 });
  if (allocationsResult.error) return NextResponse.json({ error: allocationsResult.error.message }, { status: 500 });

  const candidates = await Promise.all(
    (((candidatesResult.data ?? []) as unknown as CandidateRow[]) ?? []).map(async (candidate) => ({
      ...candidate,
      documente: await Promise.all(
        (candidate.documente ?? []).map(async (doc) => {
          const { data: signed } = await service.storage.from(doc.storage_bucket || BUCKET).createSignedUrl(doc.storage_path, 60 * 60);
          return { ...doc, signed_url: signed?.signedUrl ?? null };
        })
      ),
    }))
  );

  return NextResponse.json({
    candidati: candidates,
    alocari: allocationsResult.data ?? [],
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json().catch(() => null) as {
    nume?: string;
    email?: string;
    telefon?: string;
    rol_tinta?: string;
  } | null;

  const nume = String(body?.nume ?? "").trim();
  if (!nume) return NextResponse.json({ error: "Completeaza numele expertului." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("licitatie_expert_candidati")
    .insert({
      licitatie_id: params.id,
      nume,
      email: body?.email?.trim() || null,
      telefon: body?.telefon?.trim() || null,
      rol_tinta: body?.rol_tinta?.trim() || null,
      status: "nou",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ candidatId: data.id });
}
