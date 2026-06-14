import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { normalizeFormularConfig, type FormField, type FormularConfig } from "@/lib/form-schema";
import type { Factor } from "@/lib/scoring";

export const runtime = "nodejs";
type Ctx = { params: { id: string } };

export async function GET(_request: Request, { params }: Ctx) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  const [licitatie, factori] = await Promise.all([
    supabase.from("licitatii").select("id,nume,formular_config_json").eq("id", params.id).single(),
    supabase.from("factori").select("id,cod,denumire,tip,agregare,punctaj_max,config_json").eq("licitatie_id", params.id).order("ordine"),
  ]);
  if (licitatie.error) return NextResponse.json({ error: licitatie.error.message }, { status: 404 });
  if (factori.error) return NextResponse.json({ error: factori.error.message }, { status: 500 });
  return NextResponse.json({ licitatie: { ...licitatie.data, formular_config_json: normalizeFormularConfig(licitatie.data.formular_config_json) }, factori: factori.data });
}

export async function PUT(request: Request, { params }: Ctx) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  try {
    const body = await request.json();
    const config = normalizeFormularConfig(body.formular_config_json);
    const { error } = await supabase.from("licitatii").update({ formular_config_json: config }).eq("id", params.id);
    if (error) throw error;
    const { data: factori, error: fErr } = await supabase.from("factori").select("id,cod,tip,config_json").eq("licitatie_id", params.id);
    if (fErr) throw fErr;
    await syncFactorSources(supabase, config, (factori ?? []) as Factor[]);
    return NextResponse.json({ formular_config_json: config });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare necunoscuta." }, { status: 500 });
  }
}

async function syncFactorSources(supabase: any, config: FormularConfig, factori: Factor[]) {
  for (const field of config.sections.flatMap((s) => s.fields).filter((f) => f.scoring?.factorCod)) {
    const factor = factori.find((f) => f.cod === field.scoring?.factorCod);
    if (!factor) continue;
    const nextConfig: Record<string, unknown> = { ...(factor.config_json ?? {}), source: sourceForField(field) };
    if (field.scoring?.mode === "select_map" && field.options?.length) nextConfig.map = field.options.map((o) => ({ key: o.value, label: o.label, pts: Number(o.points ?? 0) }));
    const { error } = await supabase.from("factori").update({ config_json: nextConfig }).eq("id", factor.id);
    if (error) throw error;
  }
}
function sourceForField(field: FormField) { if (field.type === "contract_list") return { scope: "contract_hours_sum" }; if (field.source === "dynamic") return { scope: "dynamic", key: field.id }; return { scope: "formator", key: field.bind ?? field.id }; }
