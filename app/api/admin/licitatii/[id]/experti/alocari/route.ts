import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function PUT(request: Request, { params }: Ctx) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await request.json().catch(() => null) as {
    roleId?: string;
    roleTitle?: string;
    candidateId?: string | null;
    status?: "draft" | "validat";
  } | null;

  const roleId = String(body?.roleId ?? "").trim();
  const roleTitle = String(body?.roleTitle ?? "").trim();
  if (!roleId || !roleTitle) return NextResponse.json({ error: "Lipsesc roleId sau roleTitle." }, { status: 400 });

  const service = createServiceClient();

  if (body?.candidateId) {
    const { data: candidate, error: candidateError } = await service
      .from("licitatie_expert_candidati")
      .select("id,status")
      .eq("id", body.candidateId)
      .eq("licitatie_id", params.id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: candidateError?.message ?? "Candidatul nu exista." }, { status: 404 });
    }
  }

  const status = body?.status ?? "validat";
  const { error } = await service.from("licitatie_expert_alocari").upsert(
    {
      licitatie_id: params.id,
      role_id: roleId,
      role_title: roleTitle,
      candidat_id: body?.candidateId ?? null,
      status,
      validated_at: status === "validat" && body?.candidateId ? new Date().toISOString() : null,
    },
    { onConflict: "licitatie_id,role_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body?.candidateId) {
    await service
      .from("licitatie_expert_candidati")
      .update({ status: "validat", rol_tinta: roleId })
      .eq("id", body.candidateId)
      .eq("licitatie_id", params.id);
  }

  return NextResponse.json({ ok: true });
}
