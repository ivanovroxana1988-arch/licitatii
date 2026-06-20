import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  buildExpertFactor,
  buildFormularConfigForTender,
  buildTechnicalProposalMarkdown,
  buildTenderWorkspaceFromText,
} from "@/lib/tender-workspace";

export const runtime = "nodejs";

type UploadLike = {
  name?: string;
  type?: string;
  size?: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export async function POST(request: Request) {
  try {
    const { supabase, response } = await requireAdmin();
    if (response) return response;

    const formData = await request.formData();
    const fileValue = formData.get("file");
    const file = isUploadLike(fileValue) ? fileValue : null;
    const pastedText = String(formData.get("text") ?? "").trim();
    const sourceFilename = file?.name ?? "specificatii-text";

    let sourceText = pastedText;

    if (file && Number(file.size ?? 0) > 0) {
      sourceText = await extractTextFromUpload(file);
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
  } catch (err) {
    console.error("Tender import failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Importul specificatiilor a esuat pe server. Fireste, serverul a ales dramatismul.",
      },
      { status: 500 }
    );
  }
}

async function extractTextFromUpload(file: UploadLike): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = (file.name ?? "").toLowerCase();
  const mime = file.type ?? "";

  if (lowerName.endsWith(".pdf") || mime === "application/pdf") {
    try {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = pdfParseModule.default ?? pdfParseModule;
      const parsed = await pdfParse(buffer);
      return String(parsed.text ?? "").trim();
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Nu am putut citi PDF-ul: ${err.message}`
          : "Nu am putut citi PDF-ul. Verifica daca pdf-parse este instalat si daca fisierul nu este scanat ca imagine."
      );
    }
  }

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || mime.startsWith("text/")) {
    return buffer.toString("utf8").trim();
  }

  throw new Error("Pentru acest MVP accept PDF, TXT sau text lipit in formular. DOCX intra in episodul urmator al serialului birocratic.");
}

function isUploadLike(value: unknown): value is UploadLike {
  return !!(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}
