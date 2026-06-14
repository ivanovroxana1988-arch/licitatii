import { NextResponse } from "next/server";
import { loadAplicarePayload } from "@/lib/aplicare";
import { createServiceClient } from "@/lib/supabase-server";
import { validateRequiredForm } from "@/lib/form-schema";

export const runtime = "nodejs";
type Ctx = { params: { token: string } };

export async function POST(_request: Request, { params }: Ctx) {
  try {
    const supabase = createServiceClient();
    const payload = await loadAplicarePayload(supabase, params.token);
    if (!payload) return NextResponse.json({ error: "Linkul de aplicare nu este valid." }, { status: 404 });
    if (payload.aplicare.readonly) return NextResponse.json(payload);
    if (!payload.aplicare.formator_id) return NextResponse.json({ error: "Salveaza datele inainte de finalizare." }, { status: 400 });
    const details = validateRequiredForm({ config: payload.licitatie.formular_config_json, formator: payload.formator, contracte: payload.contracte, answers: payload.aplicare.raspunsuri_formular_json, documente: payload.documente });
    if (details.length) return NextResponse.json({ error: "Aplicarea nu poate fi finalizata.", details }, { status: 400 });
    const { error } = await supabase.from("aplicari").update({ status: "finalizat", finalizat_la: new Date().toISOString() }).eq("id", payload.aplicare.id);
    if (error) throw error;
    return NextResponse.json(await loadAplicarePayload(supabase, params.token));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare necunoscuta." }, { status: 500 });
  }
}
