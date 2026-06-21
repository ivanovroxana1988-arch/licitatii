"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { COMPANY_DOCUMENT_TYPES, type CompanyDocument, type CompanyProfile } from "@/lib/company-profile";

const FIELDS: Array<{ key: keyof CompanyProfile; label: string; type?: "textarea" }> = [
  { key: "denumire", label: "Denumire companie" },
  { key: "cui", label: "CUI / CIF" },
  { key: "nr_reg_com", label: "Nr. Registrul Comertului" },
  { key: "sediu", label: "Sediu social", type: "textarea" },
  { key: "localitate", label: "Localitate" },
  { key: "judet", label: "Judet" },
  { key: "iban", label: "IBAN" },
  { key: "banca", label: "Banca" },
  { key: "reprezentant_nume", label: "Reprezentant legal" },
  { key: "reprezentant_functie", label: "Functie reprezentant" },
  { key: "email", label: "Email oficial" },
  { key: "telefon", label: "Telefon oficial" },
  { key: "website", label: "Website" },
  { key: "caen_principal", label: "CAEN principal" },
  { key: "caen_secundare", label: "CAEN secundare", type: "textarea" },
  { key: "descriere", label: "Descriere companie", type: "textarea" },
  { key: "experienta_similara", label: "Experienta similara standard", type: "textarea" },
];

const DECLARATIONS = [
  ["declaratie_neincadrare_164", "Declaratie neincadrare art. 164"],
  ["declaratie_neincadrare_165", "Declaratie neincadrare art. 165"],
  ["declaratie_neincadrare_167", "Declaratie neincadrare art. 167"],
  ["declaratie_conflict_interese", "Declaratie conflict de interese"],
  ["declaratie_beneficiar_real", "Declaratie beneficiar real"],
  ["declaratie_mediu_munca", "Declaratie mediu/munca/SSM"],
  ["declaratie_gdpr", "Declaratie GDPR"],
] as const;

type CompanyDocumentWithUrl = CompanyDocument & { id: string; signed_url?: string | null; text_extras?: string | null };
type OcrLog = { label: string; progress: number };
type PdfJsModule = { version: string; GlobalWorkerOptions: { workerSrc: string }; getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> } };
type PdfDocument = { numPages: number; getPage: (pageNumber: number) => Promise<PdfPage> };
type PdfPage = { getViewport: (params: { scale: number }) => { width: number; height: number }; render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } };

export default function CompanyProfileForm() {
  const [profile, setProfile] = useState<CompanyProfile>({ declaratii_json: {}, documente_json: {} });
  const [documents, setDocuments] = useState<CompanyDocumentWithUrl[]>([]);
  const [documentType, setDocumentType] = useState("certificat_constatator");
  const [runOcr, setRunOcr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<OcrLog | null>(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try { await Promise.all([loadProfile(), loadDocuments()]); }
    catch (err) { setError(err instanceof Error ? err.message : "Nu am putut incarca profilul companiei."); }
    finally { setLoading(false); }
  }

  async function loadProfile() {
    const res = await fetch("/api/admin/companie/profil", { cache: "no-store" });
    const data = await readProfileResponse(res);
    if (!res.ok) throw new Error(data.error ?? "Nu am putut citi profilul companiei.");
    setProfile(data.profil ?? { declaratii_json: {}, documente_json: {} });
  }

  async function loadDocuments() {
    const res = await fetch("/api/admin/companie/documente", { cache: "no-store" });
    const data = await readDocumentsResponse(res);
    if (!res.ok) throw new Error(data.error ?? "Nu am putut citi documentele companiei.");
    setDocuments(data.documente ?? []);
  }

  async function saveProfileData(nextProfile: CompanyProfile) {
    const res = await fetch("/api/admin/companie/profil", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextProfile) });
    const data = await readProfileResponse(res);
    if (!res.ok) throw new Error(data.error ?? "Nu am putut salva profilul companiei.");
    setProfile(data.profil ?? nextProfile);
    return data.profil ?? nextProfile;
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null); setMessage(null);
    try { await saveProfileData(profile); setMessage("Profilul companiei a fost salvat."); }
    catch (err) { setError(err instanceof Error ? err.message : "Nu am putut salva profilul companiei."); }
    finally { setBusy(false); }
  }

  async function uploadCompanyDocument(file?: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setError("Se accepta doar PDF."); return; }
    setDocumentBusy("upload"); setError(null); setMessage(null); setLog(null);
    try {
      let ocrText = "";
      if (runOcr) {
        setLog({ label: "Rulez OCR pentru PDF scanat", progress: 0 });
        ocrText = (await ocrPdf(file, 4, setLog)).trim();
        if (ocrText.length > 20) {
          const nextProfile = applyTextToProfile(profile, ocrText, documentType);
          await saveProfileData(nextProfile);
        }
      }
      const formData = new FormData();
      formData.append("file", file); formData.append("tip", documentType); formData.append("titlu", labelForDocumentType(documentType));
      const res = await fetch("/api/admin/companie/documente", { method: "POST", body: formData });
      const data = await readDocumentUploadResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca documentul companiei.");
      if (data.profil) setProfile((current) => ({ ...current, ...data.profil }));
      await loadDocuments();
      const extracted = data.extractedProfilePatch ? Object.keys(data.extractedProfilePatch).length : 0;
      setMessage(ocrText.length > 20 ? `Document incarcat. OCR: ${ocrText.length} caractere; profil completat unde au fost gasite date.` : extracted ? `Document incarcat si profil completat pe ${extracted} campuri.` : "Document incarcat. Text nedetectat; incearca un PDF mai clar.");
    } catch (err) { setError(err instanceof Error ? err.message : "Nu am putut incarca documentul companiei."); }
    finally { setDocumentBusy(null); setLog(null); }
  }

  async function deleteDocument(documentId: string) {
    setDocumentBusy(documentId); setError(null);
    try {
      const res = await fetch(`/api/admin/companie/documente?documentId=${encodeURIComponent(documentId)}`, { method: "DELETE" });
      const data = await readDocumentUploadResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut sterge documentul.");
      await loadDocuments();
    } catch (err) { setError(err instanceof Error ? err.message : "Nu am putut sterge documentul."); }
    finally { setDocumentBusy(null); }
  }

  function updateField(key: keyof CompanyProfile, value: string) { setProfile((current) => ({ ...current, [key]: value })); }
  function updateFlag(group: "declaratii_json" | "documente_json", key: string, value: boolean) { setProfile((current) => ({ ...current, [group]: { ...((current[group] as Record<string, unknown>) ?? {}), [key]: value } })); }

  if (loading) return <section style={panelStyle}>Incarc profilul companiei...</section>;

  return (
    <form onSubmit={saveProfile} style={panelStyle}>
      <div style={kickerStyle}>PROFIL COMPANIE</div>
      <h1 style={titleStyle}>Date standard pentru completare automata</h1>
      <p style={mutedStyle}>Completeaza o singura data datele firmei si incarca PDF-urile standard. Pentru PDF scanat, OCR-ul ruleaza in browser inainte de upload.</p>
      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={okStyle}>{message}</div>}
      {log && <div style={progressBoxStyle}><span>{log.label}</span><strong>{Math.round(log.progress * 100)}%</strong></div>}
      <section style={subPanelStyle}>
        <h2 style={sectionTitleStyle}>Documente companie PDF</h2>
        <label style={checkStyle}><input type="checkbox" checked={runOcr} onChange={(event) => setRunOcr(event.currentTarget.checked)} /> Ruleaza OCR automat pentru PDF scanat inainte de upload</label>
        <div style={uploadRowStyle}>
          <select value={documentType} onChange={(event) => setDocumentType(event.currentTarget.value)} style={inputStyle}>{COMPANY_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <label style={uploadButtonStyle}>{documentBusy === "upload" ? "Procesez..." : "Incarca PDF"}<input type="file" accept="application/pdf,.pdf" disabled={documentBusy === "upload"} onChange={(event) => uploadCompanyDocument(event.currentTarget.files?.[0])} style={{ display: "none" }} /></label>
        </div>
        <div style={documentGridStyle}>{documents.map((doc) => <article key={doc.id} style={documentCardStyle}><strong style={labelStyle}>{labelForDocumentType(doc.tip)}</strong><span style={mutedStyle}>{doc.nume_fisier}</span><span style={mutedStyle}>{doc.text_extras ? `${doc.text_extras.length} caractere extrase server` : "Text nedetectat server"}</span><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{doc.signed_url && <a href={doc.signed_url} target="_blank" rel="noreferrer" style={linkButtonStyle}>Deschide</a>}<button type="button" onClick={() => deleteDocument(doc.id)} disabled={documentBusy === doc.id} style={dangerButtonStyle}>{documentBusy === doc.id ? "Sterg..." : "Sterge"}</button></div></article>)}{!documents.length && <div style={emptyStyle}>Nu exista documente PDF incarcate in profil.</div>}</div>
      </section>
      <div style={gridStyle}>{FIELDS.map((field) => <label key={field.key} style={fieldStyle}><span style={labelStyle}>{field.label}</span>{field.type === "textarea" ? <textarea value={String(profile[field.key] ?? "")} onChange={(event) => updateField(field.key, event.currentTarget.value)} rows={field.key === "experienta_similara" ? 6 : 3} style={textareaStyle} /> : <input value={String(profile[field.key] ?? "")} onChange={(event) => updateField(field.key, event.currentTarget.value)} style={inputStyle} />}</label>)}</div>
      <section style={subPanelStyle}><h2 style={sectionTitleStyle}>Declaratii standard</h2><div style={checkGridStyle}>{DECLARATIONS.map(([key, label]) => <label key={key} style={checkStyle}><input type="checkbox" checked={Boolean(profile.declaratii_json?.[key])} onChange={(event) => updateFlag("declaratii_json", key, event.currentTarget.checked)} />{label}</label>)}</div></section>
      <button type="submit" disabled={busy} style={buttonStyle}>{busy ? "Salvez..." : "Salveaza profilul companiei"}</button>
    </form>
  );
}

async function ocrPdf(file: File, maxPages: number, setLog: (log: OcrLog) => void): Promise<string> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pagesToRead = Math.min(document.numPages, Math.max(1, maxPages));
  const chunks: string[] = [];
  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    setLog({ label: `OCR pagina ${pageNumber}/${pagesToRead}`, progress: (pageNumber - 1) / pagesToRead });
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d"); if (!context) throw new Error("Nu am putut crea canvas pentru OCR.");
    await page.render({ canvasContext: context, viewport }).promise;
    const tesseract = await import("tesseract.js");
    const result = await tesseract.recognize(canvas, "ron+eng", { logger: (message: { status?: string; progress?: number }) => setLog({ label: message.status ?? "OCR", progress: Math.min(1, (pageNumber - 1 + (message.progress ?? 0)) / pagesToRead) }) });
    chunks.push(result.data.text ?? "");
  }
  return chunks.join("\n");
}

function applyTextToProfile(current: CompanyProfile, text: string, tip: string): CompanyProfile {
  const next: CompanyProfile = { ...current };
  const compact = text.replace(/\s+/g, " ");
  if (!next.cui) next.cui = findFirst(compact, [/(?:cui|cod unic de inregistrare|cod fiscal)[:\s]+([0-9]{5,12})/i, /\b([0-9]{5,12})\b/]);
  if (!next.nr_reg_com) next.nr_reg_com = findFirst(compact, [/(?:j\d{2}\/\d+\/\d{4}|f\d{2}\/\d+\/\d{4}|c\d{2}\/\d+\/\d{4})/i]);
  if (!next.caen_principal) next.caen_principal = findFirst(compact, [/(?:caen|cod caen)[:\s-]*(\d{4})/i]);
  if (!next.denumire) next.denumire = findFirst(compact, [/([A-Z0-9 .,&'-]+(?:SRL|S\.R\.L\.|SA|S\.A\.))/]);
  if (!next.sediu) next.sediu = findFirst(compact, [/(?:sediu social|sediul social|adresa sediului social|sediu)[:\s]+(.{20,220}?)(?:cui|cod unic|nr\.? reg|registrul|caen|administrator|$)/i]);
  if (tip === "certificat_beneficiar_real") next.declaratii_json = { ...(next.declaratii_json ?? {}), declaratie_beneficiar_real: true };
  if ((tip === "contract_similar" || tip === "recomandare") && !next.experienta_similara) next.experienta_similara = compact.slice(0, 900);
  return next;
}

function findFirst(text: string, patterns: RegExp[]): string | null { for (const pattern of patterns) { const match = text.match(pattern); if (match?.[1]) return match[1].trim().replace(/[;,.\s]+$/, ""); if (match?.[0]) return match[0].trim().replace(/[;,.\s]+$/, ""); } return null; }
async function readProfileResponse(res: Response): Promise<{ error?: string; profil?: CompanyProfile | null }> { return readJsonOrText(res); }
async function readDocumentsResponse(res: Response): Promise<{ error?: string; documente?: CompanyDocumentWithUrl[] }> { return readJsonOrText(res); }
async function readDocumentUploadResponse(res: Response): Promise<{ error?: string; ok?: boolean; profil?: CompanyProfile; extractedProfilePatch?: Partial<CompanyProfile> }> { return readJsonOrText(res); }
async function readJsonOrText<T extends { error?: string }>(res: Response): Promise<T> { const contentType = res.headers.get("content-type") ?? ""; if (contentType.includes("application/json")) return await res.json(); const text = await res.text(); return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` } as T; }
function labelForDocumentType(value: string): string { return COMPANY_DOCUMENT_TYPES.find((item) => item.value === value)?.label ?? value; }

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 18, display: "grid", gap: 14 };
const subPanelStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 13, display: "grid", gap: 10 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 };
const checkGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 };
const uploadRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(220px, 340px) auto", gap: 8, alignItems: "center" };
const documentGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 };
const documentCardStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: 11, display: "grid", gap: 6, background: "#f9fbfd" };
const fieldStyle: CSSProperties = { display: "grid", gap: 6 };
const checkStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "start", fontSize: 13, color: "#394554" };
const inputStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: "9px 10px", fontSize: 13 };
const textareaStyle: CSSProperties = { ...inputStyle, resize: "vertical" };
const buttonStyle: CSSProperties = { justifySelf: "start", border: "none", borderRadius: 8, padding: "10px 14px", background: "#16324f", color: "#fff", fontWeight: 700, fontSize: 13 };
const uploadButtonStyle: CSSProperties = { ...buttonStyle, justifySelf: "stretch", textAlign: "center", cursor: "pointer", background: "#2f6f6a" };
const linkButtonStyle: CSSProperties = { border: "1px solid #2f6f6a", borderRadius: 8, padding: "7px 10px", color: "#2f6f6a", textDecoration: "none", fontWeight: 700, fontSize: 12 };
const dangerButtonStyle: CSSProperties = { border: "1px solid #b3261e", borderRadius: 8, padding: "7px 10px", color: "#b3261e", background: "#fff", fontWeight: 700, fontSize: 12 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { fontSize: 22, color: "#16324f", margin: 0 };
const sectionTitleStyle: CSSProperties = { fontSize: 15, color: "#16324f", margin: 0 };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", lineHeight: 1.5, margin: 0 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13 };
const okStyle: CSSProperties = { border: "1px solid #b7dfc8", background: "#f2fbf6", color: "#2e7d52", borderRadius: 8, padding: 11, fontSize: 13 };
const emptyStyle: CSSProperties = { border: "1px dashed #dde3ea", borderRadius: 8, padding: 12, color: "#5a6573", fontSize: 13 };
const progressBoxStyle: CSSProperties = { border: "1px solid #dde3ea", background: "#f6f8fb", borderRadius: 8, padding: 11, fontSize: 13, color: "#394554", display: "flex", justifyContent: "space-between", gap: 12 };
