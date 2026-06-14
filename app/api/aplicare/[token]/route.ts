import { NextResponse } from "next/server";
import { loadAplicarePayload, objectOrEmpty } from "@/lib/aplicare";
import { createServiceClient } from "@/lib/supabase-server";
import { countTopics, type AplicareContract, type AplicareFormator } from "@/lib/form-schema";

export const runtime = "nodejs";

type RouteContext = { params: { token: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createServiceClient();
    const payload = await loadAplicarePayload(supabase, params.token);
    if (!payload) {
      return NextResponse.json({ error: "Linkul de aplicare nu este valid." }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const supabase = createServiceClient();
    const existing = await loadAplicarePayload(supabase, params.token);

    if (!existing) {
      return NextResponse.json({ error: "Linkul de aplicare nu este valid." }, { status: 404 });
    }
    if (existing.aplicare.readonly) {
      return NextResponse.json(
        { error: "Aplicarea a fost finalizata si nu mai poate fi modificata." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const formator = sanitizeFormator(body.formator);
    const contracte = sanitizeContracte(body.contracte);
    const answers = objectOrEmpty(body.raspunsuri_formular_json);

    let formatorId = existing.aplicare.formator_id;
    if (!formatorId) {
      const { data, error } = await supabase
        .from("formatori")
        .insert(formator)
        .select("id")
        .single();
      if (error) throw error;
      formatorId = data.id;
    } else {
      const { error } = await supabase.from("formatori").update(formator).eq("id", formatorId);
      if (error) throw error;
    }
    if (!formatorId) throw new Error("Nu am putut determina formatorul aplicarii.");
    const resolvedFormatorId = formatorId;

    await syncContracte(supabase, resolvedFormatorId, contracte);

    const { error: updateAplicareError } = await supabase
      .from("aplicari")
      .update({
        formator_id: resolvedFormatorId,
        status: "in_completare",
        raspunsuri_formular_json: answers,
      })
      .eq("id", existing.aplicare.id);
    if (updateAplicareError) throw updateAplicareError;

    const payload = await loadAplicarePayload(supabase, params.token);
    return NextResponse.json(payload);
  } catch (error) {
    return serverError(error);
  }
}

async function syncContracte(
  supabase: ReturnType<typeof createServiceClient>,
  formatorId: string,
  contracte: AplicareContract[]
) {
  const idsToKeep = contracte.map((contract) => contract.id).filter(Boolean) as string[];
  let deleteQuery = supabase.from("contracte").delete().eq("formator_id", formatorId);
  if (idsToKeep.length) deleteQuery = deleteQuery.not("id", "in", `(${idsToKeep.join(",")})`);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  for (const [index, contract] of contracte.entries()) {
    const row = {
      formator_id: formatorId,
      organizatie: contract.organizatie,
      domeniu_org: contract.domeniu_org ?? null,
      structura_complexa: !!contract.structura_complexa,
      perioada: contract.perioada ?? null,
      ore: Number(contract.ore) || 0,
      tematici: contract.tematici ?? null,
      ordine: index,
    };

    if (contract.id) {
      const { error } = await supabase
        .from("contracte")
        .update(row)
        .eq("id", contract.id)
        .eq("formator_id", formatorId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("contracte").insert(row);
      if (error) throw error;
    }
  }
}

function sanitizeFormator(value: unknown): AplicareFormator {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    nume: text(input.nume),
    prenume: text(input.prenume),
    email: text(input.email),
    telefon: text(input.telefon),
    domeniu_studii: text(input.domeniu_studii),
    studii_detalii: text(input.studii_detalii),
    are_cor_242401: !!input.are_cor_242401,
    ani_management: number(input.ani_management),
    bio: text(input.bio),
  };
}

function sanitizeContracte(value: unknown): AplicareContract[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => !!item)
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id ? item.id : undefined,
      organizatie: text(item.organizatie),
      domeniu_org: text(item.domeniu_org),
      structura_complexa: !!item.structura_complexa,
      perioada: text(item.perioada),
      ore: number(item.ore),
      tematici: text(item.tematici),
      nr_tematici: countTopics(text(item.tematici)),
      ordine: index,
    }))
    .filter(
      (contract) =>
        contract.organizatie.trim() ||
        contract.domeniu_org?.trim() ||
        contract.perioada?.trim() ||
        contract.tematici?.trim() ||
        Number(contract.ore) > 0
    );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Eroare necunoscuta.";
  return NextResponse.json({ error: message }, { status: 500 });
}
