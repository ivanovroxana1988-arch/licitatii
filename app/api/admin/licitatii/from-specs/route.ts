import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  buildExpertFactor,
  buildFormularConfigForTender,
  buildTechnicalProposalMarkdown,
  buildTenderWorkspaceFromText,
} from "@/lib/tender-workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");
  const pastedText = String(formData.get("text") ?? "").trim();
  const sourceFilename = file instanceof File ? file.name : "specificatii-text";

  let sourceText = pastedText;

  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      sourceText = parsed.text.trim();
    } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
      sourceText = buffer.toString("utf8").trim();
    } else {
      return NextResponse.json(
        { error: "Pentru acest MVP accept PDF, TXT sau text lipit in formular. DOCX intra in episodul urmator al serialului birocratic." },
        { status: 400 }
      );
    }
  }

  if (!sourceText || sourceText.length < 200) {
    return NextResponse.json(
      { error: "Textul extras este prea scurt. Incarca PDF-ul complet sau lipeste continutul caietului de sarcini." },
      { status: 400 }
    );
  }

  const workspace = buildTenderWorkspaceFromText(sourceText);
  const technicalProposal = buildTechnicalProposalMarkdown(workspace);

  const { data: licitatie, error: licitatieError } = await supabase
    .from("licitatii")
    .insert({
      nume: workspace.identity.title,
      referinta: workspace.identity.reference,
      beneficiar: workspace.identity.beneficiary,
      status: "draft",
      pondere_pret: workspace.award.financialWeight,
      formular_config_json: buildFormularConfigForTender(),
    })
    .select("id")
    .single();

  if (licitatieError || !licitatie) {
    return NextResponse.json({ error: licitatieError?.message ?? "Nu am putut crea licitatia." }, { status: 500 });
  }

  const expertFactor = buildExpertFactor();
  const { error: factoriError } = await supabase.from("factori").insert({
    licitatie_id: licitatie.id,
    ...expertFactor,
  });

  if (factoriError) {
    return NextResponse.json({ error: factoriError.message }, { status: 500 });
  }

  const { error: criteriiError } = await supabase.from("criterii_eligibilitate").insert([
    {
      licitatie_id: licitatie.id,
      eticheta: "Certificat Formator recunoscut national sau echivalent",
      tip: "bool",
      factor_cod: null,
      valoare_min: null,
      ordine: 1,
    },
    {
      licitatie_id: licitatie.id,
      eticheta: "Minimum 1 sesiune de instruire relevanta in domeniul rolului propus",
      tip: "min_factor",
      factor_cod: "EXP",
      valoare_min: 1,
      ordine: 2,
    },
  ]);

  if (criteriiError) {
    return NextResponse.json({ error: criteriiError.message }, { status: 500 });
  }

  const { error: workspaceError } = await supabase.from("licitatie_workspaces").insert({
    licitatie_id: licitatie.id,
    source_filename: sourceFilename,
    source_text: sourceText,
    brief_json: workspace,
    technical_proposal_markdown: technicalProposal,
  });

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 });
  }

  return NextResponse.json({
    licitatieId: licitatie.id,
    redirectTo: `/admin/licitatii/${licitatie.id}/workspace`,
  });
}
