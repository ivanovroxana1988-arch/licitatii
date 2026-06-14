import { NextResponse } from "next/server";
import { loadAplicarePayload } from "@/lib/aplicare";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
type Ctx = { params: { token: string; documentId: string } };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const supabase = createServiceClient();
    const payload = await loadAplicarePayload(supabase, params.token);
    if (!payload) return NextResponse.json({ error: "Linkul de aplicare nu este valid." }, { status: 404 });
    if (payload.aplicare.readonly) return NextResponse.json({ error: "Aplicarea a fost finalizata." }, { status: 409 });
    if (!payload.aplicare.formator_id) return NextResponse.json({ error: "Aplicarea nu are formator salvat." }, { status: 400 });
    const { data: doc, error: readErr } = await supabase.from("documente").select("id,formator_id,storage_path").eq("id", params.documentId).maybeSingle();
    if (readErr) throw readErr;
    if (!doc || doc.formator_id !== payload.aplicare.formator_id) return NextResponse.json({ error: "Documentul nu a fost gasit." }, { status: 404 });
    const { error: storageErr } = await supabase.storage.from("documente").remove([doc.storage_path]);
    if (storageErr) throw storageErr;
    const { error } = await supabase.from("documente").delete().eq("id", params.documentId).eq("formator_id", payload.aplicare.formator_id);
    if (error) throw error;
    return NextResponse.json(await loadAplicarePayload(supabase, params.token));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare necunoscuta." }, { status: 500 });
  }
}
