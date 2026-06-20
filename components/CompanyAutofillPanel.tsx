"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

type AutofillResult = {
  values?: Record<string, unknown>;
  missing?: string[];
  suggestions?: string[];
  error?: string;
};

export default function CompanyAutofillPanel({ licitatieId }: { licitatieId: string }) {
  const [result, setResult] = useState<AutofillResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function generateAutofill() {
    setBusy(true);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/companie/autofill`, { method: "POST" });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut genera autofill pentru companie.");
      setResult(data);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Nu am putut genera autofill pentru companie." });
    } finally {
      setBusy(false);
    }
  }

  const count = result?.values ? Object.keys(result.values).filter((key) => hasValue(result.values?.[key])).length : 0;

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={kickerStyle}>PROFIL COMPANIE → AUTOFILL</div>
          <h2 style={titleStyle}>Completare automata formulare</h2>
          <p style={mutedStyle}>
            Foloseste profilul companiei ca sursa unica pentru date de identificare, declaratii si campuri administrative. Pentru ca a scrie CUI-ul de 47 de ori nu este strategie, este pedeapsa medievala cu Wi-Fi.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
          <Link href="/admin/companie" style={secondaryButtonStyle}>Editeaza profil</Link>
          <button type="button" onClick={generateAutofill} disabled={busy} style={buttonStyle}>
            {busy ? "Generez..." : "Genereaza autofill"}
          </button>
        </div>
      </div>

      {result?.error && <div style={errorStyle}>{result.error}</div>}

      {result && !result.error && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div style={scoreStyle}>{count} campuri completate</div>
          {(result.missing?.length ?? 0) > 0 && (
            <div style={warnBoxStyle}>
              <strong>Lipsuri de completat</strong>
              <ul style={listStyle}>{result.missing?.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {(result.suggestions?.length ?? 0) > 0 && (
            <div style={infoBoxStyle}>
              <strong>Recomandari</strong>
              <ul style={listStyle}>{result.suggestions?.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          <details style={detailsStyle}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Vezi valorile generate</summary>
            <pre style={preStyle}>{JSON.stringify(result.values, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

async function readApiResponse(res: Response): Promise<AutofillResult> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await res.json();
  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` };
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { fontSize: 17, color: "#16324f", marginTop: 6 };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", lineHeight: 1.5, margin: 0 };
const buttonStyle: CSSProperties = { border: "none", borderRadius: 8, padding: "10px 13px", background: "#16324f", color: "#fff", fontWeight: 700, fontSize: 13 };
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, border: "1px solid #2f6f6a", background: "#fff", color: "#2f6f6a", textDecoration: "none" };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13, marginTop: 12 };
const warnBoxStyle: CSSProperties = { border: "1px solid #f0c36d", background: "#fffaf0", borderRadius: 8, padding: 11, color: "#394554", fontSize: 13 };
const infoBoxStyle: CSSProperties = { border: "1px solid #dde3ea", background: "#f6f8fb", borderRadius: 8, padding: 11, color: "#394554", fontSize: 13 };
const scoreStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 700, color: "#16324f" };
const listStyle: CSSProperties = { margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 };
const detailsStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 11 };
const preStyle: CSSProperties = { whiteSpace: "pre-wrap", background: "#f6f8fb", border: "1px solid #dde3ea", borderRadius: 8, padding: 12, marginTop: 10, fontSize: 12, overflowX: "auto" };
