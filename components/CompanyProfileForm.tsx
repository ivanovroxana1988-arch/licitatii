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

type CompanyDocumentWithUrl = CompanyDocument & {
  id: string;
  signed_url?: string | null;
  marime_bytes?: number | null;
  incarcat_la?: string;
};

export default function CompanyProfileForm() {
  const [profile, setProfile] = useState<CompanyProfile>({ declaratii_json: {}, documente_json: {} });
  const [documents, setDocuments] = useState<CompanyDocumentWithUrl[]>([]);
  const [documentType, setDocumentType] = useState("certificat_constatator");
  const [busy, setBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadProfile(), loadDocuments()]);
    } finally {
      setLoading(false);
    }
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

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/companie/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await readProfileResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva profilul companiei.");
      setProfile(data.profil ?? profile);
      setMessage("Profilul companiei a fost salvat. Mic miracol administrativ, fara stampila.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva profilul companiei.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCompanyDocument(file?: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Se accepta doar PDF. Word-ul ramane acolo unde ii este locul: convertit in PDF.");
      return;
    }

    setDocumentBusy("upload");
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("tip", documentType);
    formData.append("titlu", labelForDocumentType(documentType));

    try {
      const res = await fetch("/api/admin/companie/documente", { method: "POST", body: formData });
      const data = await readDocumentUploadResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca documentul companiei.");
      if (data.profil) setProfile(data.profil);
      await loadDocuments();
      const extracted = data.extractedProfilePatch ? Object.keys(data.extractedProfilePatch).length : 0;
      setMessage(extracted ? `Document incarcat si profil completat automat pe ${extracted} campuri.` : "Document incarcat. Nu am detectat campuri noi clare pentru profil.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut incarca documentul companiei.");
    } finally {
      setDocumentBusy(null);
    }
  }

  async function deleteDocument(documentId: string) {
    setDocumentBusy(documentId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companie/documente?documentId=${encodeURIComponent(documentId)}`, { method: "DELETE" });
      const data = await readDocumentUploadResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut sterge documentul.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut sterge documentul.");
    } finally {
      setDocumentBusy(null);
    }
  }

  function updateField(key: keyof CompanyProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateFlag(group: "declaratii_json" | "documente_json", key: string, value: boolean) {
    setProfile((current) => ({
      ...current,
      [group]: {
        ...((current[group] as Record<string, unknown>) ?? {}),
        [key]: value,
      },
    }));
  }

  if (loading) return <section style={panelStyle}>Incarc profilul companiei...</section>;

  return (
    <form onSubmit={saveProfile} style={panelStyle}>
      <div style={kickerStyle}>PROFIL COMPANIE</div>
      <h1 style={titleStyle}>Date standard pentru completare automata</h1>
      <p style={mutedStyle}>
        Completeaza o singura data datele firmei si incarca PDF-urile standard. Aplicatia extrage text din documente, completeaza profilul unde poate si apoi le poate atasa automat in dosarul final al unei licitatii. Birocratia, redusa la o rutina. Incredibil ce face civilizatia cand isi propune lucruri mici.
      </p>

      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={okStyle}>{message}</div>}

      <section style={subPanelStyle}>
        <h2 style={sectionTitleStyle}>Documente companie PDF</h2>
        <p style={mutedStyle}>Incarca certificatul constatator, fiscal, beneficiar real, imputerniciri, contracte si recomandari. Documentele potrivite pot fi copiate automat in Dosar final cand generezi autofill pe licitatie.</p>
        <div style={uploadRowStyle}>
          <select value={documentType} onChange={(event) => setDocumentType(event.currentTarget.value)} style={inputStyle}>
            {COMPANY_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <label style={uploadButtonStyle}>
            {documentBusy === "upload" ? "Incarc..." : "Incarca PDF"}
            <input type="file" accept="application/pdf,.pdf" disabled={documentBusy === "upload"} onChange={(event) => uploadCompanyDocument(event.currentTarget.files?.[0])} style={{ display: "none" }} />
          </label>
        </div>

        <div style={documentGridStyle}>
          {documents.map((doc) => (
            <article key={doc.id} style={documentCardStyle}>
              <strong style={labelStyle}>{labelForDocumentType(doc.tip)}</strong>
              <span style={mutedStyle}>{doc.nume_fisier}</span>
              <span style={mutedStyle}>{doc.text_extras ? `${doc.text_extras.length} caractere extrase` : "Text nedetectat"}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {doc.signed_url && <a href={doc.signed_url} target="_blank" rel="noreferrer" style={linkButtonStyle}>Deschide</a>}
                <button type="button" onClick={() => deleteDocument(doc.id)} disabled={documentBusy === doc.id} style={dangerButtonStyle}>{documentBusy === doc.id ? "Sterg..." : "Sterge"}</button>
              </div>
            </article>
          ))}
          {!documents.length && <div style={emptyStyle}>Nu exista documente PDF incarcate in profil.</div>}
        </div>
      </section>

      <div style={gridStyle}>
        {FIELDS.map((field) => (
          <label key={field.key} style={fieldStyle}>
            <span style={labelStyle}>{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                value={String(profile[field.key] ?? "")}
                onChange={(event) => updateField(field.key, event.currentTarget.value)}
                rows={field.key === "experienta_similara" ? 6 : 3}
                style={textareaStyle}
              />
            ) : (
              <input
                value={String(profile[field.key] ?? "")}
                onChange={(event) => updateField(field.key, event.currentTarget.value)}
                style={inputStyle}
              />
            )}
          </label>
        ))}
      </div>

      <section style={subPanelStyle}>
        <h2 style={sectionTitleStyle}>Declaratii standard</h2>
        <div style={checkGridStyle}>
          {DECLARATIONS.map(([key, label]) => (
            <label key={key} style={checkStyle}>
              <input
                type="checkbox"
                checked={Boolean(profile.declaratii_json?.[key])}
                onChange={(event) => updateFlag("declaratii_json", key, event.currentTarget.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <button type="submit" disabled={busy} style={buttonStyle}>{busy ? "Salvez..." : "Salveaza profilul companiei"}</button>
    </form>
  );
}

async function readProfileResponse(res: Response): Promise<{ error?: string; profil?: CompanyProfile | null }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await res.json();
  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` };
}

async function readDocumentsResponse(res: Response): Promise<{ error?: string; documente?: CompanyDocumentWithUrl[] }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await res.json();
  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` };
}

async function readDocumentUploadResponse(res: Response): Promise<{ error?: string; ok?: boolean; profil?: CompanyProfile; extractedProfilePatch?: Partial<CompanyProfile> }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await res.json();
  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` };
}

function labelForDocumentType(value: string): string {
  return COMPANY_DOCUMENT_TYPES.find((item) => item.value === value)?.label ?? value;
}

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
