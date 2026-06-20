"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

export type FinalDossierGroup = {
  category: string;
  title: string;
  items: string[];
};

type UploadedDocument = {
  id: string;
  document_key: string;
  categorie: string;
  titlu: string;
  nume_fisier: string;
  marime_bytes?: number | null;
  incarcat_la: string;
  signed_url?: string | null;
};

type Props = {
  licitatieId: string;
  groups: FinalDossierGroup[];
};

export default function FinalDossierUploads({ licitatieId, groups }: Props) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item, index) => ({
          category: group.category,
          groupTitle: group.title,
          title: item,
          key: `${group.category}-${index + 1}-${slugify(item)}`,
        }))
      ),
    [groups]
  );

  useEffect(() => {
    void loadDocuments();
  }, [licitatieId]);

  async function loadDocuments() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/dosar-final/documente`, { cache: "no-store" });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut citi documentele incarcate.");
      setDocuments(data.documente ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut citi documentele incarcate.");
    }
  }

  async function uploadDocument(row: { key: string; title: string; category: string }, file?: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Se accepta doar fisiere PDF. Da, Word-ul poate astepta pe hol.");
      return;
    }

    setBusyKey(row.key);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentKey", row.key);
    formData.append("title", row.title);
    formData.append("category", row.category);

    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/dosar-final/documente`, {
        method: "POST",
        body: formData,
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca PDF-ul.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut incarca PDF-ul.");
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteDocument(documentKey: string) {
    setBusyKey(documentKey);
    setError(null);

    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/dosar-final/documente?documentKey=${encodeURIComponent(documentKey)}`, {
        method: "DELETE",
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut sterge documentul.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut sterge documentul.");
    } finally {
      setBusyKey(null);
    }
  }

  const byKey = new Map(documents.map((doc) => [doc.document_key, doc]));
  const uploadedCount = rows.filter((row) => byKey.has(row.key)).length;

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={kickerStyle}>DOSAR FINAL</div>
          <h2 style={titleStyle}>PDF-uri pe fiecare document</h2>
          <p style={mutedStyle}>
            Incarca PDF-ul pentru fiecare document cerut. Aplicatia tine evidenta ce lipseste, pentru ca altfel ajungem la arheologie administrativa cu foldere numite „final_final_semnat_bun”.
          </p>
        </div>
        <div style={scoreStyle}>{uploadedCount} / {rows.length}</div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
        {groups.map((group) => {
          const groupRows = rows.filter((row) => row.category === group.category);
          return (
            <article key={group.category} style={groupStyle}>
              <h3 style={groupTitleStyle}>{group.title}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {groupRows.map((row) => {
                  const doc = byKey.get(row.key);
                  const busy = busyKey === row.key;
                  return (
                    <div key={row.key} style={rowStyle}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong style={{ color: "#16324f", fontSize: 13 }}>{row.title}</strong>
                        {doc ? (
                          <span style={mutedStyle}>
                            Incarcat: {doc.nume_fisier} · {formatBytes(doc.marime_bytes)} · {formatDate(doc.incarcat_la)}
                          </span>
                        ) : (
                          <span style={warnTextStyle}>Lipseste PDF-ul</span>
                        )}
                      </div>

                      <div style={actionsStyle}>
                        {doc?.signed_url && (
                          <a href={doc.signed_url} target="_blank" rel="noreferrer" style={linkStyle}>
                            Deschide PDF
                          </a>
                        )}
                        <label style={uploadButtonStyle}>
                          {busy ? "Se incarca..." : doc ? "Inlocuieste PDF" : "Incarca PDF"}
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={busy}
                            onChange={(event) => uploadDocument(row, event.currentTarget.files?.[0])}
                            style={{ display: "none" }}
                          />
                        </label>
                        {doc && (
                          <button type="button" disabled={busy} onClick={() => deleteDocument(row.key)} style={dangerButtonStyle}>
                            Sterge
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

async function readApiResponse(res: Response): Promise<{ error?: string; documente?: UploadedDocument[] }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as { error?: string; documente?: UploadedDocument[] };
  }

  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function formatBytes(value?: number | null): string {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const groupStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 13, display: "grid", gap: 10 };
const rowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto", gap: 12, alignItems: "center", border: "1px solid #eef2f6", borderRadius: 8, padding: 11 };
const actionsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { fontSize: 17, color: "#16324f", marginTop: 6 };
const groupTitleStyle: CSSProperties = { fontSize: 15, color: "#16324f", margin: 0 };
const mutedStyle: CSSProperties = { fontSize: 12, color: "#5a6573", lineHeight: 1.5 };
const warnTextStyle: CSSProperties = { fontSize: 12, color: "#8a5a00" };
const scoreStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 700, color: "#16324f" };
const linkStyle: CSSProperties = { border: "1px solid #2f6f6a", borderRadius: 7, padding: "8px 10px", color: "#2f6f6a", textDecoration: "none", fontWeight: 700, fontSize: 12 };
const uploadButtonStyle: CSSProperties = { ...linkStyle, background: "#2f6f6a", color: "#fff", cursor: "pointer" };
const dangerButtonStyle: CSSProperties = { border: "1px solid #b3261e", borderRadius: 7, padding: "8px 10px", color: "#b3261e", background: "#fff", fontWeight: 700, fontSize: 12 };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13, marginTop: 12 };
