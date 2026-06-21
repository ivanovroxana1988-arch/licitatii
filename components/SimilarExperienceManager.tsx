"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { SimilarContract } from "@/lib/similar-experience";

type ContractRow = SimilarContract & { id: string; signed_url?: string | null };

type Eligibility = {
  eligible: boolean;
  requiredValue: number;
  eligibleValue: number;
  selectedContractIds: string[];
  missing: string[];
  warnings: string[];
  relevantKeywords: string[];
};

export default function SimilarExperienceManager({ licitatieId }: { licitatieId?: string }) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [editing, setEditing] = useState<ContractRow | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void loadContracts(); }, []);

  async function loadContracts() {
    setError(null);
    const res = await fetch("/api/admin/experienta-similara/contracte", { cache: "no-store" });
    const data = await readJson<{ error?: string; contracte?: ContractRow[] }>(res);
    if (!res.ok) { setError(data.error ?? "Nu am putut citi contractele."); return; }
    setContracts(data.contracte ?? []);
  }

  async function uploadContract(file?: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setError("Se accepta doar PDF."); return; }
    setBusy(true); setError(null); setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/experienta-similara/contracte", { method: "POST", body: formData });
      const data = await readJson<{ error?: string; contract?: ContractRow }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca documentul.");
      await loadContracts();
      setEditing(data.contract ?? null);
      setMessage("Contract incarcat. Verifica si corecteaza valoarea, obiectul si data, pentru ca OCR-ul nu e notar public, din pacate.");
    } catch (err) { setError(err instanceof Error ? err.message : "Nu am putut incarca documentul."); }
    finally { setBusy(false); }
  }

  async function saveContract(contract: ContractRow) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch("/api/admin/experienta-similara/contracte", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contract) });
      const data = await readJson<{ error?: string; contract?: ContractRow }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva contractul.");
      setEditing(null);
      await loadContracts();
      setMessage("Contract salvat in experienta similara.");
    } catch (err) { setError(err instanceof Error ? err.message : "Nu am putut salva contractul."); }
    finally { setBusy(false); }
  }

  async function deleteContract(id: string) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/experienta-similara/contracte?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await readJson<{ error?: string }>(res);
    if (!res.ok) setError(data.error ?? "Nu am putut sterge contractul.");
    await loadContracts();
    setBusy(false);
  }

  async function calculateEligibility() {
    if (!licitatieId) return;
    setBusy(true); setError(null); setEligibility(null);
    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/experienta-similara/eligibilitate`, { cache: "no-store" });
      const data = await readJson<{ error?: string; analysis?: Eligibility }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut calcula eligibilitatea.");
      setEligibility(data.analysis ?? null);
    } catch (err) { setError(err instanceof Error ? err.message : "Nu am putut calcula eligibilitatea."); }
    finally { setBusy(false); }
  }

  return (
    <section style={panelStyle}>
      <div style={kickerStyle}>EXPERIENTA SIMILARA</div>
      <h1 style={titleStyle}>Contracte relevante si eligibilitate</h1>
      <p style={mutedStyle}>Incarca contracte/recomandari, completeaza valoarea fara TVA si obiectul, iar aplicatia calculeaza daca atingi pragul cerut in licitatie. Da, in sfarsit folosim contractele ca date, nu ca PDF-uri decorative.</p>

      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={okStyle}>{message}</div>}

      <div style={actionsStyle}>
        <label style={buttonStyle}>{busy ? "Procesez..." : "Incarca PDF contract/recomandare"}<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => uploadContract(event.currentTarget.files?.[0])} style={{ display: "none" }} /></label>
        {licitatieId && <button type="button" onClick={calculateEligibility} disabled={busy} style={secondaryButtonStyle}>Calculeaza eligibilitatea pentru licitatie</button>}
      </div>

      {eligibility && <EligibilityBox eligibility={eligibility} />}

      <div style={gridStyle}>
        {contracts.map((contract) => (
          <article key={contract.id} style={cardStyle}>
            <strong style={cardTitleStyle}>{contract.titlu}</strong>
            <span style={mutedStyle}>{contract.beneficiar || "Beneficiar necompletat"}</span>
            <span style={mutedStyle}>{contract.obiect || "Obiect necompletat"}</span>
            <span style={moneyStyle}>{formatMoney(Number(contract.valoare_fara_tva ?? 0))}</span>
            <span style={mutedStyle}>Data: {contract.data_finalizare || contract.data_contract || "necompletata"}</span>
            <span style={mutedStyle}>Domenii: {contract.domenii_text || "necompletate"}</span>
            <div style={buttonRowStyle}>
              {contract.signed_url && <a href={contract.signed_url} target="_blank" rel="noreferrer" style={linkButtonStyle}>PDF</a>}
              <button type="button" onClick={() => setEditing(contract)} style={secondarySmallButtonStyle}>Editeaza</button>
              <button type="button" onClick={() => deleteContract(contract.id)} style={dangerButtonStyle}>Sterge</button>
            </div>
          </article>
        ))}
        {!contracts.length && <div style={emptyStyle}>Nu exista contracte incarcate.</div>}
      </div>

      {editing && <ContractEditor contract={editing} onCancel={() => setEditing(null)} onSave={saveContract} busy={busy} />}
    </section>
  );
}

function ContractEditor({ contract, onCancel, onSave, busy }: { contract: ContractRow; onCancel: () => void; onSave: (contract: ContractRow) => void; busy: boolean }) {
  const [draft, setDraft] = useState<ContractRow>(contract);
  const set = (key: keyof ContractRow, value: string) => setDraft((current) => ({ ...current, [key]: key === "valoare_fara_tva" ? Number(value) : value }));
  return (
    <div style={modalBackdropStyle}>
      <div style={modalStyle}>
        <h2 style={titleStyle}>Editeaza contract</h2>
        <div style={formGridStyle}>
          <Field label="Titlu" value={draft.titlu ?? ""} onChange={(v) => set("titlu", v)} />
          <Field label="Beneficiar" value={draft.beneficiar ?? ""} onChange={(v) => set("beneficiar", v)} />
          <Field label="Valoare fara TVA" value={String(draft.valoare_fara_tva ?? "")} onChange={(v) => set("valoare_fara_tva", v)} />
          <Field label="Data contract" value={draft.data_contract ?? ""} onChange={(v) => set("data_contract", v)} />
          <Field label="Data finalizare/receptie" value={draft.data_finalizare ?? ""} onChange={(v) => set("data_finalizare", v)} />
          <Field label="Domenii" value={draft.domenii_text ?? ""} onChange={(v) => set("domenii_text", v)} />
          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}><span style={labelStyle}>Obiect contract</span><textarea rows={4} value={draft.obiect ?? ""} onChange={(e) => set("obiect", e.currentTarget.value)} style={inputStyle} /></label>
        </div>
        <div style={buttonRowStyle}><button type="button" onClick={() => onSave(draft)} disabled={busy} style={buttonStyle}>Salveaza</button><button type="button" onClick={onCancel} style={secondaryButtonStyle}>Anuleaza</button></div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label style={{ display: "grid", gap: 6 }}><span style={labelStyle}>{label}</span><input value={value} onChange={(e) => onChange(e.currentTarget.value)} style={inputStyle} /></label>;
}

function EligibilityBox({ eligibility }: { eligibility: Eligibility }) {
  return <div style={eligibility.eligible ? okStyle : warnStyle}><strong>{eligibility.eligible ? "Eligibil pe experienta similara" : "Nu esti inca eligibil / necesita completari"}</strong><span>Prag: {formatMoney(eligibility.requiredValue)} | Eligibil calculat: {formatMoney(eligibility.eligibleValue)}</span>{eligibility.relevantKeywords.length > 0 && <span>Cuvinte relevante: {eligibility.relevantKeywords.join(", ")}</span>}{eligibility.missing.map((item) => <span key={item}>• {item}</span>)}{eligibility.warnings.map((item) => <span key={item}>⚠ {item}</span>)}</div>;
}

async function readJson<T extends { error?: string }>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await res.json();
  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` } as T;
}

function formatMoney(value: number): string {
  return value ? `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(value)} lei` : "valoare lipsa";
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 18, display: "grid", gap: 14 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { fontSize: 22, color: "#16324f", margin: 0 };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", lineHeight: 1.5, margin: 0 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const actionsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 };
const cardStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: 12, display: "grid", gap: 6 };
const cardTitleStyle: CSSProperties = { color: "#16324f", fontSize: 14 };
const moneyStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#16324f" };
const inputStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: "9px 10px", fontSize: 13 };
const buttonStyle: CSSProperties = { border: "none", borderRadius: 8, padding: "10px 14px", background: "#16324f", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, background: "#fff", color: "#2f6f6a", border: "1px solid #2f6f6a" };
const secondarySmallButtonStyle: CSSProperties = { ...secondaryButtonStyle, padding: "7px 10px", fontSize: 12 };
const linkButtonStyle: CSSProperties = { ...secondarySmallButtonStyle, textDecoration: "none" };
const dangerButtonStyle: CSSProperties = { border: "1px solid #b3261e", borderRadius: 8, padding: "7px 10px", color: "#b3261e", background: "#fff", fontWeight: 700, fontSize: 12 };
const buttonRowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13 };
const okStyle: CSSProperties = { border: "1px solid #b7dfc8", background: "#f2fbf6", color: "#2e7d52", borderRadius: 8, padding: 11, fontSize: 13, display: "grid", gap: 4 };
const warnStyle: CSSProperties = { border: "1px solid #f0c36d", background: "#fffaf0", color: "#8a5a00", borderRadius: 8, padding: 11, fontSize: 13, display: "grid", gap: 4 };
const emptyStyle: CSSProperties = { border: "1px dashed #dde3ea", borderRadius: 8, padding: 12, color: "#5a6573", fontSize: 13 };
const modalBackdropStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(17,22,29,.35)", display: "grid", placeItems: "center", padding: 16, zIndex: 20 };
const modalStyle: CSSProperties = { width: "min(760px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 10, padding: 18, display: "grid", gap: 14 };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
