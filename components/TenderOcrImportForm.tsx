"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

type OcrLog = {
  label: string;
  progress: number;
};

type PdfJsModule = {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

export default function TenderOcrImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<OcrLog | null>(null);
  const [maxPages, setMaxPages] = useState(12);

  async function runOcr() {
    if (!file) {
      setError("Incarca un PDF scanat sau o imagine. OCR-ul nu ghiceste din aer, inca.");
      return;
    }

    setBusy(true);
    setError(null);
    setText("");
    setLog({ label: "Pornesc OCR", progress: 0 });

    try {
      const lowerName = file.name.toLowerCase();
      const extracted = lowerName.endsWith(".pdf") || file.type === "application/pdf"
        ? await ocrPdf(file, maxPages, setLog)
        : await ocrImage(file, setLog, "imagine");

      const normalized = extracted.replace(/\n{3,}/g, "\n\n").trim();
      setText(normalized);
      setLog({ label: `OCR finalizat: ${normalized.length} caractere`, progress: 1 });

      if (normalized.length < 200) {
        setError("OCR-ul a extras prea putin text. Verifica daca scanarea este clara sau creste rezolutia fisierului.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR-ul a esuat. Pentru ca, evident, nici pixelii nu coopereaza mereu.");
    } finally {
      setBusy(false);
    }
  }

  async function createTenderFromText() {
    if (text.trim().length < 200) {
      setError("Textul OCR este prea scurt pentru a crea o licitatie.");
      return;
    }

    setCreating(true);
    setError(null);
    const formData = new FormData();
    formData.append("text", text.trim());

    try {
      const res = await fetch("/api/admin/licitatii/from-specs", {
        method: "POST",
        body: formData,
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut crea proiectul de licitatie.");
      if (!data.redirectTo) throw new Error("Raspunsul serverului nu contine pagina de redirect.");
      router.push(data.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut crea proiectul de licitatie.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section style={panelStyle}>
      <div style={kickerStyle}>OCR SEPARAT → TEXT EDITABIL → PROIECT LICITATIE</div>
      <h1 style={titleStyle}>OCR pentru PDF scanat sau imagini</h1>
      <p style={mutedStyle}>
        Foloseste pasul asta cand PDF-ul este de fapt o poza lunga cu pretentii administrative. OCR-ul ruleaza in browser, extrage textul, il poti corecta, apoi creezi licitatia din text.
      </p>

      <div style={gridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Fisier scanat</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            style={inputStyle}
          />
          <small style={mutedStyle}>PDF scanat sau imagine. Pentru PDF-uri foarte mari, ruleaza pe primele pagini si apoi mareste limita.</small>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Numar maxim pagini PDF</span>
          <input
            type="number"
            min={1}
            max={60}
            value={maxPages}
            onChange={(event) => setMaxPages(Number(event.currentTarget.value) || 1)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={runOcr} disabled={busy || !file} style={buttonStyle}>
          {busy ? "Rulez OCR..." : "Extrage text prin OCR"}
        </button>
        <button type="button" onClick={createTenderFromText} disabled={creating || busy || text.trim().length < 200} style={secondaryButtonStyle}>
          {creating ? "Creez licitatia..." : "Creeaza licitatie din text"}
        </button>
      </div>

      {log && (
        <div style={progressBoxStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{log.label}</span>
            <strong>{Math.round(log.progress * 100)}%</strong>
          </div>
          <div style={progressTrackStyle}><div style={{ ...progressFillStyle, width: `${Math.round(log.progress * 100)}%` }} /></div>
        </div>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      <label style={fieldStyle}>
        <span style={labelStyle}>Text extras, editabil</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          rows={18}
          placeholder="Textul extras prin OCR va aparea aici. Corecteaza-l inainte sa creezi licitatia, fiindca OCR-ul citeste uneori ca un functionar obosit vineri la 15:58."
          style={textareaStyle}
        />
      </label>
    </section>
  );
}

async function ocrPdf(file: File, maxPages: number, setLog: (log: OcrLog) => void): Promise<string> {
  const pdfjs = await loadPdfJs();
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pagesToRead = Math.min(document.numPages, Math.max(1, maxPages));
  const chunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    setLog({ label: `Randez pagina ${pageNumber}/${pagesToRead}`, progress: (pageNumber - 1) / pagesToRead });
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Nu am putut crea canvas pentru OCR.");

    await page.render({ canvasContext: context, viewport }).promise;
    const pageText = await ocrImage(canvas, setLog, `pagina ${pageNumber}/${pagesToRead}`, pageNumber - 1, pagesToRead);
    chunks.push(`\n\n--- Pagina ${pageNumber} ---\n${pageText}`);
  }

  return chunks.join("\n");
}

async function ocrImage(
  image: File | HTMLCanvasElement,
  setLog: (log: OcrLog) => void,
  label: string,
  pageIndex = 0,
  totalPages = 1
): Promise<string> {
  const tesseract = await import("tesseract.js");
  const result = await tesseract.recognize(image, "ron+eng", {
    logger: (message: { status?: string; progress?: number }) => {
      const localProgress = typeof message.progress === "number" ? message.progress : 0;
      const globalProgress = Math.min(1, (pageIndex + localProgress) / totalPages);
      setLog({ label: `${label}: ${message.status ?? "OCR"}`, progress: globalProgress });
    },
  });

  return result.data.text ?? "";
}

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  return pdfjs;
}

async function readApiResponse(res: Response): Promise<{ error?: string; redirectTo?: string }> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await res.json()) as { error?: string; redirectTo?: string };
  }

  const responseText = await res.text();
  const compact = responseText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return { error: compact || `Serverul a raspuns cu status ${res.status}, dar nu a trimis JSON.` };
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 10, padding: 18, display: "grid", gap: 14 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 };
const fieldStyle: CSSProperties = { display: "grid", gap: 7 };
const inputStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: 10, fontSize: 13, background: "#fff" };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 330, resize: "vertical" };
const buttonStyle: CSSProperties = { border: "none", borderRadius: 8, padding: "10px 14px", background: "#16324f", color: "#fff", fontWeight: 700, fontSize: 13 };
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, background: "#2f6f6a" };
const titleStyle: CSSProperties = { fontSize: 22, color: "#16324f", margin: 0 };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", lineHeight: 1.5 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em" };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13 };
const progressBoxStyle: CSSProperties = { border: "1px solid #dde3ea", background: "#f6f8fb", borderRadius: 8, padding: 11, fontSize: 13, color: "#394554", display: "grid", gap: 8 };
const progressTrackStyle: CSSProperties = { height: 7, background: "#dde3ea", borderRadius: 20, overflow: "hidden" };
const progressFillStyle: CSSProperties = { height: "100%", background: "#2f6f6a" };
