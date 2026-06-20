"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ExpertAnalysisResult } from "@/lib/expert-analysis";
import type { TenderExpertRole } from "@/lib/tender-workspace";

type ExpertDocument = {
  id: string;
  tip: string;
  nume_fisier: string;
  marime_bytes?: number | null;
  incarcat_la: string;
  signed_url?: string | null;
};

type ExpertCandidate = {
  id: string;
  nume: string;
  email?: string | null;
  telefon?: string | null;
  rol_tinta?: string | null;
  status: string;
  scor_total: number;
  recomandare?: string | null;
  analiza_json?: ExpertAnalysisResult | null;
  documente?: ExpertDocument[];
};

type ExpertAllocation = {
  role_id: string;
  role_title: string;
  candidat_id?: string | null;
  status: string;
  validated_at?: string | null;
};

type Props = {
  licitatieId: string;
  roles: TenderExpertRole[];
};

const DOCUMENT_TYPES = [
  { value: "cv", label: "CV" },
  { value: "certificat_formator", label: "Certificat formator" },
  { value: "diploma", label: "Diploma studii" },
  { value: "contract", label: "Contract / dovada contractuala" },
  { value: "recomandare", label: "Recomandare" },
  { value: "altul", label: "Alt document" },
];

export default function ExpertRecruitmentWorkspace({ licitatieId, roles }: Props) {
  const [candidates, setCandidates] = useState<ExpertCandidate[]>([]);
  const [allocations, setAllocations] = useState<ExpertAllocation[]>([]);
  const [newCandidate, setNewCandidate] = useState({ nume: "", email: "", telefon: "", rol_tinta: roles[0]?.id ?? "" });
  const [docTypes, setDocTypes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadExperts();
  }, [licitatieId]);

  const allocationByRole = useMemo(() => new Map(allocations.map((item) => [item.role_id, item])), [allocations]);
  const candidateById = useMemo(() => new Map(candidates.map((item) => [item.id, item])), [candidates]);

  async function loadExperts() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/experti`, { cache: "no-store" });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut citi expertii.");
      setCandidates(data.candidati ?? []);
      setAllocations(data.alocari ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut citi expertii.");
    }
  }

  async function createCandidate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(null);

    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/experti`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCandidate),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut crea candidatul.");
      setNewCandidate({ nume: "", email: "", telefon: "", rol_tinta: roles[0]?.id ?? "" });
      await loadExperts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut crea candidatul.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadDocument(candidateId: string, file?: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Se accepta doar PDF. Daca vine un .docx, il convertim inainte, ca nu suntem chiar la bal mascat.");
      return;
    }

    setBusy(`upload-${candidateId}`);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("tip", docTypes[candidateId] ?? "cv");

    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/experti/${candidateId}/documente`, {
        method: "POST",
        body: formData,
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca documentul.");
      await loadExperts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut incarca documentul.");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeCandidate(candidateId: string) {
    setBusy(`analyze-${candidateId}`);
    setError(null);

    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/experti/${candidateId}/analiza`, { method: "POST" });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut analiza candidatul.");
      await loadExperts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut analiza candidatul.");
    } finally {
      setBusy(null);
    }
  }

  async function allocate(role: TenderExpertRole, candidateId: string | null) {
    setBusy(`allocate-${role.id}`);
    setError(null);

    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/experti/alocari`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: role.id, roleTitle: role.title, candidateId, status: candidateId ? "validat" : "draft" }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva alocarea.");
      await loadExperts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva alocarea.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={kickerStyle}>EXPERTI SI RECRUTARE</div>
          <h2 style={titleStyle}>Alocare experti pe roluri</h2>
          <p style={mutedStyle}>
            Incarci CV, certificat de formator, diplome, recomandari si contracte. Aplicatia extrage textul din PDF, estimeaza compatibilitatea pe fiecare rol si iti arata ce expert merita alocat. Adica mai putina ghiceala si mai putin „pare ok”. Ce vremuri intunecate pentru improvizatie.
          </p>
        </div>
        <div style={scoreStyle}>{allocations.filter((item) => item.candidat_id).length} / {roles.length}</div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={roleGridStyle}>
        {roles.map((role) => {
          const allocation = allocationByRole.get(role.id);
          const allocated = allocation?.candidat_id ? candidateById.get(allocation.candidat_id) : null;
          const bestCandidates = [...candidates]
            .map((candidate) => ({ candidate, roleScore: candidate.analiza_json?.roles?.find((r) => r.roleId === role.id)?.score ?? 0 }))
            .sort((a, b) => b.roleScore - a.roleScore)
            .slice(0, 3);

          return (
            <article key={role.id} style={roleCardStyle}>
              <div style={kickerStyle}>ROL</div>
              <h3 style={miniTitleStyle}>{role.title}</h3>
              <p style={mutedStyle}>{allocated ? `Alocat: ${allocated.nume}` : "Nealocat"}</p>
              <select
                value={allocation?.candidat_id ?? ""}
                onChange={(event) => allocate(role, event.currentTarget.value || null)}
                style={inputStyle}
                disabled={busy === `allocate-${role.id}`}
              >
                <option value="">Fara expert alocat</option>
                {candidates.map((candidate) => {
                  const roleScore = candidate.analiza_json?.roles?.find((r) => r.roleId === role.id)?.score ?? 0;
                  return <option key={candidate.id} value={candidate.id}>{candidate.nume} {roleScore ? `- ${roleScore}%` : ""}</option>;
                })}
              </select>
              {bestCandidates.length > 0 && (
                <div style={{ display: "grid", gap: 5 }}>
                  <strong style={smallTitleStyle}>Recomandari rapide</strong>
                  {bestCandidates.map(({ candidate, roleScore }) => (
                    <button key={candidate.id} type="button" onClick={() => allocate(role, candidate.id)} style={quickButtonStyle}>
                      {candidate.nume} · {roleScore || "neanalizat"}%
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <form onSubmit={createCandidate} style={createFormStyle}>
        <h3 style={miniTitleStyle}>Adauga expert candidat</h3>
        <input placeholder="Nume expert" value={newCandidate.nume} onChange={(e) => setNewCandidate((v) => ({ ...v, nume: e.currentTarget.value }))} style={inputStyle} />
        <input placeholder="Email" value={newCandidate.email} onChange={(e) => setNewCandidate((v) => ({ ...v, email: e.currentTarget.value }))} style={inputStyle} />
        <input placeholder="Telefon" value={newCandidate.telefon} onChange={(e) => setNewCandidate((v) => ({ ...v, telefon: e.currentTarget.value }))} style={inputStyle} />
        <select value={newCandidate.rol_tinta} onChange={(e) => setNewCandidate((v) => ({ ...v, rol_tinta: e.currentTarget.value }))} style={inputStyle}>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}
        </select>
        <button type="submit" disabled={busy === "create" || !newCandidate.nume.trim()} style={primaryButtonStyle}>
          {busy === "create" ? "Salvez..." : "Adauga candidat"}
        </button>
      </form>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {candidates.map((candidate) => (
          <article key={candidate.id} style={candidateCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={miniTitleStyle}>{candidate.nume}</h3>
                <p style={mutedStyle}>{[candidate.email, candidate.telefon].filter(Boolean).join(" · ") || "Fara contact"}</p>
                <span style={badgeStyle}>{candidate.status}</span>
              </div>
              <div style={scoreStyle}>{Math.round(Number(candidate.scor_total ?? 0))}%</div>
            </div>

            {candidate.recomandare && <p style={recommendationStyle}>{candidate.recomandare}</p>}

            <div style={uploadRowStyle}>
              <select value={docTypes[candidate.id] ?? "cv"} onChange={(e) => setDocTypes((v) => ({ ...v, [candidate.id]: e.currentTarget.value }))} style={inputStyle}>
                {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <label style={uploadButtonStyle}>
                {busy === `upload-${candidate.id}` ? "Incarc..." : "Incarca document PDF"}
                <input type="file" accept="application/pdf,.pdf" disabled={busy === `upload-${candidate.id}`} onChange={(event) => uploadDocument(candidate.id, event.currentTarget.files?.[0])} style={{ display: "none" }} />
              </label>
              <button type="button" onClick={() => analyzeCandidate(candidate.id)} disabled={busy === `analyze-${candidate.id}` || !(candidate.documente?.length)} style={primaryButtonStyle}>
                {busy === `analyze-${candidate.id}` ? "Analizez..." : "Analizeaza compatibilitatea"}
              </button>
            </div>

            <div style={documentGridStyle}>
              {(candidate.documente ?? []).map((doc) => (
                <a key={doc.id} href={doc.signed_url ?? "#"} target="_blank" rel="noreferrer" style={documentPillStyle}>
                  {labelForDoc(doc.tip)} · {doc.nume_fisier}
                </a>
              ))}
              {!(candidate.documente?.length) && <span style={warnTextStyle}>Nu exista documente incarcate.</span>}
            </div>

            {candidate.analiza_json?.roles?.length ? (
              <div style={analysisGridStyle}>
                {candidate.analiza_json.roles.map((role) => (
                  <div key={role.roleId} style={analysisCardStyle}>
                    <strong style={{ color: "#16324f" }}>{role.roleTitle}</strong>
                    <span style={mutedStyle}>Compatibilitate: {role.score}% · punctaj estimat expert: {role.punctajEstimat}/10</span>
                    <span style={badgeStyle}>{role.verdict}</span>
                    {role.motive.slice(0, 2).map((item) => <small key={item} style={mutedStyle}>• {item}</small>)}
                    {role.lipsuri.slice(0, 2).map((item) => <small key={item} style={warnTextStyle}>• {item}</small>)}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        {!candidates.length && <div style={emptyStyle}>Nu exista candidati. Adauga experti sau invita-i prin formularul de recrutare.</div>}
      </div>
    </section>
  );
}

async function readApiResponse(res: Response): Promise<{
  error?: string;
  candidati?: ExpertCandidate[];
  alocari?: ExpertAllocation[];
  candidatId?: string;
  analiza?: ExpertAnalysisResult;
}> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }

  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` };
}

function labelForDoc(value: string): string {
  return DOCUMENT_TYPES.find((item) => item.value === value)?.label ?? value;
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const roleGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 14 };
const roleCardStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: 13, display: "grid", gap: 9, background: "#f9fbfd" };
const createFormStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, alignItems: "end", border: "1px solid #eef2f6", borderRadius: 8, padding: 13, marginTop: 14 };
const candidateCardStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: 14, display: "grid", gap: 12 };
const uploadRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(160px, 220px) auto auto", gap: 8, alignItems: "center" };
const documentGridStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const analysisGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 };
const analysisCardStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 10, display: "grid", gap: 5 };
const inputStyle: CSSProperties = { width: "100%", border: "1px solid #dde3ea", borderRadius: 8, padding: "9px 10px", fontSize: 13, background: "#fff" };
const primaryButtonStyle: CSSProperties = { border: "none", borderRadius: 8, padding: "9px 11px", background: "#16324f", color: "#fff", fontWeight: 700, fontSize: 12 };
const uploadButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "#2f6f6a", display: "inline-block", textAlign: "center", cursor: "pointer" };
const quickButtonStyle: CSSProperties = { border: "1px solid #2f6f6a", borderRadius: 7, padding: "7px 9px", background: "#fff", color: "#2f6f6a", fontWeight: 700, fontSize: 12, textAlign: "left" };
const documentPillStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 20, padding: "6px 9px", color: "#2f6f6a", textDecoration: "none", fontSize: 12, fontWeight: 700 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { fontSize: 17, color: "#16324f", marginTop: 6 };
const miniTitleStyle: CSSProperties = { fontSize: 15, color: "#16324f", margin: 0 };
const smallTitleStyle: CSSProperties = { fontSize: 12, color: "#394554" };
const mutedStyle: CSSProperties = { fontSize: 12, color: "#5a6573", lineHeight: 1.5 };
const warnTextStyle: CSSProperties = { fontSize: 12, color: "#8a5a00" };
const badgeStyle: CSSProperties = { justifySelf: "start", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 20, background: "#e6f4ec", color: "#2e7d52" };
const scoreStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 700, color: "#16324f" };
const recommendationStyle: CSSProperties = { border: "1px solid #dde3ea", background: "#f6f8fb", borderRadius: 8, padding: 10, fontSize: 13, color: "#394554", lineHeight: 1.5 };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13, marginTop: 12 };
const emptyStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: 14, color: "#5a6573", background: "#f9fbfd", fontSize: 13 };
