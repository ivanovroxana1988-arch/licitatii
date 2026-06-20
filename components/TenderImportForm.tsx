"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

export default function TenderImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (text.trim()) formData.append("text", text.trim());

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
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={panelStyle}>
      <div style={kickerStyle}>SPECIFICATII TEHNICE → PROIECT LICITATIE</div>
      <h1 style={titleStyle}>Creeaza licitatie din caietul de sarcini</h1>
      <p style={mutedStyle}>
        Incarci PDF-ul sau lipesti textul. Aplicatia extrage logica de punctaj, creeaza proiectul, configureaza formularul de recrutare si pregateste scheletul propunerii tehnice. Birocratia nu dispare, dar macar o punem la munca.
      </p>

      <div style={gridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Fisier specificatii</span>
          <input
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            style={inputStyle}
          />
          <small style={mutedStyle}>MVP: PDF, TXT sau MD. Pentru DOCX adaugam parser separat.</small>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Sau lipeste textul caietului de sarcini</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            rows={14}
            placeholder="Lipeste aici continutul caietului de sarcini..."
            style={textareaStyle}
          />
        </label>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <button type="submit" disabled={busy || (!file && text.trim().length < 200)} style={buttonStyle}>
        {busy ? "Citesc specificatiile..." : "Genereaza proiectul"}
      </button>
    </form>
  );
}

async function readApiResponse(res: Response): Promise<{ error?: string; redirectTo?: string }> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await res.json()) as { error?: string; redirectTo?: string };
  }

  const text = await res.text();
  const compact = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  return {
    error:
      compact ||
      `Serverul a raspuns cu status ${res.status}, dar nu a trimis JSON. Superb, exact ce lipsea din meniu.`,
  };
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 10,
  padding: 18,
  display: "grid",
  gap: 14,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

const fieldStyle: CSSProperties = { display: "grid", gap: 7 };

const inputStyle: CSSProperties = {
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
  background: "#fff",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 260,
  resize: "vertical",
};

const buttonStyle: CSSProperties = {
  justifySelf: "start",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  background: "#16324f",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
};

const titleStyle: CSSProperties = { fontSize: 22, color: "#16324f", margin: 0 };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", lineHeight: 1.5 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em" };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13 };
