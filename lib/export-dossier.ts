import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AplicarePayload } from "@/lib/aplicare";
import { documentTypeLabel, type AplicareDocument } from "@/lib/form-schema";

const PAGE_SIZE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.08, 0.18, 0.29);
const MUTED = rgb(0.35, 0.4, 0.46);
const LINE = rgb(0.84, 0.88, 0.92);
const ACCENT = rgb(0.18, 0.44, 0.42);

 type PdfContext = {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
  width: number;
  height: number;
};

type DownloadedFile = {
  bytes: Uint8Array;
  contentType: string;
};

export async function buildDossierPdf(
  supabase: SupabaseClient,
  payload: AplicarePayload
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const firstPage = doc.addPage(PAGE_SIZE);
  const { width, height } = firstPage.getSize();
  const ctx: PdfContext = { doc, page: firstPage, regular, bold, y: height - MARGIN, width, height };

  drawCover(ctx, payload);
  drawCv(ctx, payload);
  drawOrganizations(ctx, payload);
  drawDeclarations(ctx, payload);
  await appendUploadedDocuments(ctx, supabase, payload.documente);

  return doc.save();
}

export function buildDossierFilename(payload: AplicarePayload): string {
  const formator = formatName(payload.formator.prenume, payload.formator.nume) || "formator";
  const referinta = payload.licitatie.referinta || payload.licitatie.nume || "licitatie";
  return `${slugify(`dosar-${formator}-${referinta}`)}.pdf`;
}

function drawCover(ctx: PdfContext, payload: AplicarePayload) {
  drawTopRule(ctx);
  drawText(ctx, "DOSAR FORMATOR", 28, ctx.bold, INK);
  drawWrappedText(ctx, payload.licitatie.nume, 15, ctx.bold, INK, 19);
  ctx.y -= 8;
  drawLabelValue(ctx, "Referinta", payload.licitatie.referinta || "-");
  drawLabelValue(ctx, "Beneficiar", payload.licitatie.beneficiar || "-");
  drawLabelValue(ctx, "Formator", formatName(payload.formator.prenume, payload.formator.nume) || "-");
  drawLabelValue(ctx, "Email", payload.formator.email || "-");
  drawLabelValue(ctx, "Telefon", payload.formator.telefon || "-");
  drawLabelValue(ctx, "Status aplicare", payload.aplicare.status);
  drawLabelValue(ctx, "Generat la", new Date().toLocaleDateString("ro-RO"));

  ctx.y -= 12;
  drawSectionTitle(ctx, "Continut dosar");
  drawBullet(ctx, "CV formator generat din datele completate");
  drawBullet(ctx, "Lista organizatiilor si marcajul pentru structura complexa");
  drawBullet(ctx, "Declaratii-tip completate automat");
  drawBullet(ctx, `${payload.documente.length} documente justificative incarcate`);
}

function drawCv(ctx: PdfContext, payload: AplicarePayload) {
  addPage(ctx, "CV formator");
  const { formator, contracte } = payload;

  drawSectionTitle(ctx, "Date personale");
  drawLabelValue(ctx, "Nume", formatName(formator.prenume, formator.nume) || "-");
  drawLabelValue(ctx, "Email", formator.email || "-");
  drawLabelValue(ctx, "Telefon", formator.telefon || "-");

  drawSectionTitle(ctx, "Studii si certificari");
  drawLabelValue(ctx, "Domeniu studii", formator.domeniu_studii || "-");
  drawWrappedText(ctx, formator.studii_detalii || "Nu au fost completate detalii despre studii.", 10, ctx.regular, MUTED, 14);
  drawLabelValue(ctx, "Certificat Formator COR 242401", formator.are_cor_242401 ? "Da" : "Nu");
  drawLabelValue(ctx, "Ani experienta management", String(Number(formator.ani_management ?? 0)));

  drawSectionTitle(ctx, "Profil profesional");
  drawWrappedText(ctx, formator.bio || "Nu a fost completat un profil profesional.", 10, ctx.regular, MUTED, 14);

  drawSectionTitle(ctx, "Experienta tabelara");
  if (contracte.length === 0) {
    drawWrappedText(ctx, "Nu exista contracte salvate pentru acest formator.", 10, ctx.regular, MUTED, 14);
    return;
  }

  contracte.forEach((contract, index) => {
    ensureSpace(ctx, 82);
    drawText(ctx, `${index + 1}. ${contract.organizatie || "Organizatie necompletata"}`, 11, ctx.bold, INK);
    drawWrappedText(ctx, `Domeniu: ${contract.domeniu_org || "-"} | Perioada: ${contract.perioada || "-"} | Ore: ${Number(contract.ore ?? 0)} | Tematici: ${contract.tematici || "-"}`, 9, ctx.regular, MUTED, 12);
    drawWrappedText(ctx, `Structura complexa: ${contract.structura_complexa ? "Da" : "Nu"}`, 9, ctx.regular, MUTED, 12);
    ctx.y -= 5;
  });
}

function drawOrganizations(ctx: PdfContext, payload: AplicarePayload) {
  addPage(ctx, "Lista organizatiilor");
  drawWrappedText(
    ctx,
    "Marcajul de structura complexa indica organizatiile care pot sustine criteriile tehnice configurate pentru licitatie.",
    10,
    ctx.regular,
    MUTED,
    14
  );
  ctx.y -= 6;

  if (payload.contracte.length === 0) {
    drawWrappedText(ctx, "Nu exista organizatii introduse.", 10, ctx.regular, MUTED, 14);
    return;
  }

  payload.contracte.forEach((contract, index) => {
    ensureSpace(ctx, 70);
    drawText(ctx, `${index + 1}. ${contract.organizatie || "Organizatie necompletata"}`, 12, ctx.bold, INK);
    drawLabelValue(ctx, "Domeniu organizatie", contract.domeniu_org || "-");
    drawLabelValue(ctx, "Structura complexa", contract.structura_complexa ? "Da" : "Nu");
    drawLabelValue(ctx, "Perioada", contract.perioada || "-");
    drawLabelValue(ctx, "Tematici", contract.tematici || "-");
    ctx.y -= 8;
  });
}

function drawDeclarations(ctx: PdfContext, payload: AplicarePayload) {
  addPage(ctx, "Declaratii-tip");
  const name = formatName(payload.formator.prenume, payload.formator.nume) || "formatorul";
  const licitatie = payload.licitatie.nume;
  const referinta = payload.licitatie.referinta ? `, referinta ${payload.licitatie.referinta}` : "";

  drawSectionTitle(ctx, "Declaratie de disponibilitate");
  drawWrappedText(
    ctx,
    `Subsemnatul/Subsemnata ${name}, declar ca sunt disponibil(a) pentru participarea in cadrul procedurii ${licitatie}${referinta}, conform rolului de formator si calendarului agreat de beneficiar.`,
    11,
    ctx.regular,
    INK,
    16
  );
  drawSignatureBlock(ctx);

  drawSectionTitle(ctx, "Declaratie privind acuratetea datelor");
  drawWrappedText(
    ctx,
    "Declar pe propria raspundere ca informatiile completate in formularul de aplicare si documentele incarcate in dosar sunt reale, complete si pot fi utilizate pentru alcatuirea ofertei tehnice.",
    11,
    ctx.regular,
    INK,
    16
  );
  drawSignatureBlock(ctx);
}

async function appendUploadedDocuments(
  ctx: PdfContext,
  supabase: SupabaseClient,
  documente: AplicareDocument[]
) {
  const sorted = [...documente].sort((a, b) => {
    const byType = typePriority(a.tip) - typePriority(b.tip);
    if (byType !== 0) return byType;
    return String(a.incarcat_la ?? "").localeCompare(String(b.incarcat_la ?? ""));
  });

  if (sorted.length === 0) {
    addPage(ctx, "Documente justificative incarcate");
    drawWrappedText(ctx, "Nu exista documente incarcate pentru acest formator.", 10, ctx.regular, MUTED, 14);
    return;
  }

  for (const document of sorted) {
    const downloaded = await downloadStorageFile(supabase, document);
    addAttachmentSeparator(ctx, document);

    if (!downloaded) {
      drawWrappedText(ctx, "Fisierul nu a putut fi descarcat din Storage si nu a fost inclus in dosar.", 10, ctx.regular, MUTED, 14);
      continue;
    }

    try {
      if (isPdf(document, downloaded.contentType)) {
        await appendPdf(ctx, downloaded.bytes);
      } else if (isImage(document, downloaded.contentType)) {
        await appendImage(ctx, document, downloaded);
      } else {
        drawWrappedText(ctx, "Tipul fisierului nu este acceptat la exportul PDF.", 10, ctx.regular, MUTED, 14);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eroare necunoscuta.";
      drawWrappedText(ctx, `Fisierul nu a putut fi inclus: ${message}`, 10, ctx.regular, MUTED, 14);
    }
  }
}

async function downloadStorageFile(
  supabase: SupabaseClient,
  document: AplicareDocument
): Promise<DownloadedFile | null> {
  const { data, error } = await supabase.storage.from("documente").download(document.storage_path);
  if (error || !data) return null;
  const buffer = await data.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    contentType: data.type || "",
  };
}

async function appendPdf(ctx: PdfContext, bytes: Uint8Array) {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = await ctx.doc.copyPages(source, source.getPageIndices());
  pages.forEach((page) => ctx.doc.addPage(page));
}

async function appendImage(ctx: PdfContext, document: AplicareDocument, file: DownloadedFile) {
  const pngBytes = await toEmbeddablePng(file.bytes, document, file.contentType);
  const image = await ctx.doc.embedPng(pngBytes);
  const page = ctx.doc.addPage(PAGE_SIZE);
  const { width, height } = page.getSize();
  const maxWidth = width - MARGIN * 2;
  const maxHeight = height - 140;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;

  page.drawText(safeText(document.nume_fisier), {
    x: MARGIN,
    y: height - MARGIN,
    size: 12,
    font: ctx.bold,
    color: INK,
  });
  page.drawImage(image, {
    x: (width - imageWidth) / 2,
    y: Math.max(MARGIN, height - MARGIN - 32 - imageHeight),
    width: imageWidth,
    height: imageHeight,
  });
}

async function toEmbeddablePng(bytes: Uint8Array, document: AplicareDocument, contentType: string) {
  if (isPng(document, contentType)) return bytes;

  const sharp = (await import("sharp")).default;
  return new Uint8Array(await sharp(bytes).png().toBuffer());
}

function addAttachmentSeparator(ctx: PdfContext, document: AplicareDocument) {
  addPage(ctx, `Anexa - ${documentTypeLabel(document.tip)}`);
  drawLabelValue(ctx, "Fisier", document.nume_fisier);
  drawLabelValue(ctx, "Tip document", documentTypeLabel(document.tip));
  drawLabelValue(ctx, "Incarcat la", document.incarcat_la ? new Date(document.incarcat_la).toLocaleDateString("ro-RO") : "-");
  drawLabelValue(ctx, "Marime", document.marime ? formatBytes(document.marime) : "-");
  ctx.y -= 10;
}

function addPage(ctx: PdfContext, title: string) {
  ctx.page = ctx.doc.addPage(PAGE_SIZE);
  const { width, height } = ctx.page.getSize();
  ctx.width = width;
  ctx.height = height;
  ctx.y = height - MARGIN;
  drawTopRule(ctx);
  drawText(ctx, title, 18, ctx.bold, INK);
  ctx.y -= 8;
}

function drawTopRule(ctx: PdfContext) {
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.height - MARGIN + 18,
    width: ctx.width - MARGIN * 2,
    height: 3,
    color: ACCENT,
  });
}

function drawSectionTitle(ctx: PdfContext, text: string) {
  ensureSpace(ctx, 42);
  ctx.y -= 8;
  drawText(ctx, text, 13, ctx.bold, ACCENT);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 5 },
    end: { x: ctx.width - MARGIN, y: ctx.y + 5 },
    thickness: 0.6,
    color: LINE,
  });
  ctx.y -= 8;
}

function drawLabelValue(ctx: PdfContext, label: string, value: string) {
  ensureSpace(ctx, 24);
  drawTextAt(ctx, `${label}:`, MARGIN, ctx.y, 9, ctx.bold, MUTED);
  drawWrappedTextAt(ctx, value || "-", MARGIN + 130, ctx.y, ctx.width - MARGIN * 2 - 130, 9, ctx.regular, INK, 12);
}

function drawBullet(ctx: PdfContext, text: string) {
  ensureSpace(ctx, 20);
  ctx.page.drawCircle({ x: MARGIN + 3, y: ctx.y + 3, size: 2, color: ACCENT });
  drawWrappedTextAt(ctx, text, MARGIN + 14, ctx.y, ctx.width - MARGIN * 2 - 14, 10, ctx.regular, INK, 14);
}

function drawSignatureBlock(ctx: PdfContext) {
  ensureSpace(ctx, 64);
  ctx.y -= 18;
  drawTextAt(ctx, "Data: ____________________", MARGIN, ctx.y, 10, ctx.regular, INK);
  drawTextAt(ctx, "Semnatura: ____________________", MARGIN + 230, ctx.y, 10, ctx.regular, INK);
  ctx.y -= 34;
}

function drawText(ctx: PdfContext, text: string, size: number, font: PDFFont, color: RGB) {
  ensureSpace(ctx, size + 8);
  drawTextAt(ctx, text, MARGIN, ctx.y, size, font, color);
  ctx.y -= size + 7;
}

function drawTextAt(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB
) {
  ctx.page.drawText(safeText(text || "-"), { x, y, size, font, color });
}

function drawWrappedText(
  ctx: PdfContext,
  text: string,
  size: number,
  font: PDFFont,
  color: RGB,
  lineHeight: number
) {
  drawWrappedTextAt(ctx, text, MARGIN, ctx.y, ctx.width - MARGIN * 2, size, font, color, lineHeight);
}

function drawWrappedTextAt(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
  color: RGB,
  lineHeight: number
) {
  const lines = wrapText(text || "-", font, size, maxWidth);
  let currentY = y;
  for (const line of lines) {
    if (currentY < MARGIN) {
      ctx.page = ctx.doc.addPage(PAGE_SIZE);
      const dims = ctx.page.getSize();
      ctx.width = dims.width;
      ctx.height = dims.height;
      currentY = ctx.height - MARGIN;
    }
    ctx.page.drawText(line, { x, y: currentY, size, font, color });
    currentY -= lineHeight;
  }
  ctx.y = currentY;
}

function ensureSpace(ctx: PdfContext, needed: number) {
  if (ctx.y - needed >= MARGIN) return;
  addPage(ctx, "Continuare");
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = safeText(value).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = fitLongWord(word, font, size, maxWidth, lines);
      }
    }
    if (line) lines.push(line);
  }

  return lines.length ? lines : ["-"];
}

function fitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lines: string[]
) {
  let current = "";
  for (const char of word) {
    const candidate = `${current}${char}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = char;
    }
  }
  return current;
}

function formatName(prenume?: string | null, nume?: string | null) {
  return [prenume, nume].map((part) => part?.trim()).filter(Boolean).join(" ");
}

function typePriority(tip: AplicareDocument["tip"]) {
  const priority: Record<AplicareDocument["tip"], number> = {
    recomandare: 1,
    contract: 2,
    diploma: 3,
    certificat: 4,
    altul: 5,
  };
  return priority[tip] ?? 99;
}

function isPdf(document: AplicareDocument, contentType: string) {
  return contentType.includes("pdf") || /\.pdf$/i.test(document.nume_fisier);
}

function isImage(document: AplicareDocument, contentType: string) {
  return contentType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(document.nume_fisier);
}

function isPng(document: AplicareDocument, contentType: string) {
  return contentType.includes("png") || /\.png$/i.test(document.nume_fisier);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}

function slugify(value: string) {
  return safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "dosar-formator";
}

function safeText(value: string) {
  return String(value ?? "")
    .replace(/[ăâ]/g, "a")
    .replace(/[ĂÂ]/g, "A")
    .replace(/[î]/g, "i")
    .replace(/[Î]/g, "I")
    .replace(/[șş]/g, "s")
    .replace(/[ȘŞ]/g, "S")
    .replace(/[țţ]/g, "t")
    .replace(/[ȚŢ]/g, "T")
    .replace(/[–—]/g, "-")
    .replace(/[“”„]/g, '"')
    .replace(/[’`]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}
