import { NextResponse } from "next/server";
import { loadAplicarePayload, objectOrEmpty } from "@/lib/aplicare";
import { createServiceClient } from "@/lib/supabase-server";
import { countTopics, type AplicareContract } from "@/lib/form-schema";

export const runtime = "nodejs";
type Ctx = { params: { token: string } };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const payload = await loadAplicarePayload(createServiceClient(), params.token);
    return payload ? NextResponse.json(payload) : NextResponse.json({ error: "Linkul de aplicare nu este valid." }, { status: 404 });
  } catch (e) { return err(e); }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const supabase = createServiceClient();
    const payload = await loadAplicarePayload(supabase, params.token);
    if (!payload) return NextResponse.json({ error: "Linkul de aplicare nu este valid." }, { status: 404 });
    if (payload.aplicare.readonly) return NextResponse.json({ error: "Aplicarea a fost finalizata." }, { status: 409 });
    const body = await request.json();
    const formator = sanitizeFormator(body.formator);
    const contracte = sanitizeContracte(body.contracte);
    let formatorId = payload.aplicare.formator_id;
    if (!formatorId) {
      const { data, error } = await supabase.from("formatori").insert(formator).select("id").single();
      if (error) throw error;
      formatorId = data.id;
    } else {
      const { error } = await supabase.from("formatori").update(formator).eq("id", formatorId);
      if (error) throw error;
    }
    await syncContracte(supabase, formatorId, contracte);
    const { error } = await supabase.from("aplicari").update({ formator_id: formatorId, status: "in_completare", raspunsuri_formular_json: objectOrEmpty(body.raspunsuri_formular_json) }).eq("id", payload.aplicare.id);
    if (error) throw error;
    return NextResponse.json(await loadAplicarePayload(supabase, params.token));
  } catch (e) { return err(e); }
}

async function syncContracte(supabase: ReturnType<typeof createServiceClient>, formatorId: string, contracte: AplicareContract[]) {
  const keep = contracte.map((c) => c.id).filter(Boolean) as string[];
  let del = supabase.from("contracte").delete().eq("formator_id", formatorId);
  if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) throw delErr;
  for (const [ordine, c] of contracte.entries()) {
    const row = { formator_id: formatorId, organizatie: c.organizatie, domeniu_org: c.domeniu_org || null, structura_complexa: !!c.structura_complexa, perioada: c.perioada || null, ore: Number(c.ore) || 0, tematici: c.tematici || null, ordine };
    const q = c.id ? supabase.from("contracte").update(row).eq("id", c.id).eq("formator_id", formatorId) : supabase.from("contracte").insert(row);
    const { error } = await q;
    if (error) throw error;
  }
}
function sanitizeFormator(v: any) { v = v && typeof v === "object" ? v : {}; return { nume: text(v.nume), prenume: text(v.prenume), email: text(v.email), telefon: text(v.telefon), domeniu_studii: text(v.domeniu_studii), studii_detalii: text(v.studii_detalii), are_cor_242401: !!v.are_cor_242401, ani_management: num(v.ani_management), bio: text(v.bio) }; }
function sanitizeContracte(v: any): AplicareContract[] { return Array.isArray(v) ? v.map((c, i) => ({ id: text(c.id) || undefined, organizatie: text(c.organizatie), domeniu_org: text(c.domeniu_org), structura_complexa: !!c.structura_complexa, perioada: text(c.perioada), ore: num(c.ore), tematici: text(c.tematici), nr_tematici: countTopics(text(c.tematici)), ordine: i })).filter((c) => c.organizatie || c.tematici) : []; }
function text(v: unknown) { return typeof v === "string" ? v.trim() : ""; }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function err(e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare necunoscuta." }, { status: 500 }); }
