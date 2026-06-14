import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { loadAplicarePayload } from "@/lib/aplicare";
import { buildDossierFilename, buildDossierPdf } from "@/lib/export-dossier";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: { aplicareId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const supabase = createServiceClient();
    const { data: aplicare, error } = await supabase
      .from("aplicari")
      .select("id, token, formator_id")
      .eq("id", params.aplicareId)
      .maybeSingle();

    if (error) throw error;
    if (!aplicare) {
      return NextResponse.json({ error: "Aplicarea nu a fost gasita." }, { status: 404 });
    }
    if (!aplicare.formator_id) {
      return NextResponse.json(
        { error: "Aplicarea nu are inca un formator salvat." },
        { status: 400 }
      );
    }

    const payload = await loadAplicarePayload(supabase, aplicare.token);
    if (!payload) {
      return NextResponse.json({ error: "Aplicarea nu mai este valida." }, { status: 404 });
    }

    const pdfBytes = await buildDossierPdf(supabase, payload);
    const filename = buildDossierFilename(payload);

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscuta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
