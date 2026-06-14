import { NextResponse } from "next/server";
import { loadAplicarePayload } from "@/lib/aplicare";
import { createServiceClient } from "@/lib/supabase-server";
import { DOCUMENT_TYPES, type DocumentTip } from "@/lib/form-schema";

export const runtime = "nodejs";
type Ctx = { params: { token: string } };
const MAX = 10 * 1024 * 1024;
const MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request, { params }: Ctx) {
  try {
    const supabase = createServiceClient();
    const payload = await loadAplicarePayload(supabase, params.token);
    if (!payload) return NextResponse.json({ error: "Linkul de aplicare nu este valid." }, { status: 404 });
    if (payload.aplicare.readonly) return NextResponse.json({ error: "Aplicarea a fost finalizata." }, { status: 409 });
    if (!payload.aplicare.formator_id) return NextResponse.json({ error: "Salveaza datele inainte de upload." }, { status: 400 });
    const form = await request.formData();
    const file = form.get("file");
    const tip = form.get("tip");
    const contractId = form.get("contract_id");
    if (!(file instanceof File)) return NextResponse.json({ error: "Alege un fisier." }, { status: 400 });
    if (!isTip(tip)) return NextResponse.json({ error: "Tip document invalid." }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "Fisierul depaseste 10MB." }, { status: 400 });
    if (file.type && !MIME.has(file.type)) return NextResponse.json({ error: "Sunt acceptate PDF, JPEG, PNG sau WebP." }, { status: 400 });
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-") || "document";
    const path = `${payload.aplicare.formator_id}/${tip}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("documente").upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream" });
    if (upErr) throw upErr;
    const { error } = await supabase.from("documente").insert({ formator_id: payload.aplicare.formator_id, contract_id: typeof contractId === "string" && contractId ? contractId : null, tip, nume_fisier: file.name, storage_path: path, marime: file.size });
    if (error) throw error;
    return NextResponse.json(await loadAplicarePayload(supabase, params.token));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare necunoscuta." }, { status: 500 });
  }
}
function isTip(v: unknown): v is DocumentTip { return typeof v === "string" && DOCUMENT_TYPES.includes(v as DocumentTip); }
