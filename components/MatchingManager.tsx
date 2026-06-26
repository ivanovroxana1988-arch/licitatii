"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Tender = { id: string; nume: string; referinta?: string | null; beneficiar?: string | null; status?: string | null };
type Company = { id: string; name: string; cui?: string | null; caen_codes?: string[] | null; cpv_codes?: string[] | null };
type Association = { id: string; name: string; members?: Array<{ company_id: string; company?: Company | null }> | null };
type MatchResult = {
  scores: { cpv: number; caen: number; similar_experience: number; structure: number; documents: number; overall: number };
  recommendation: string;
  strengths: string[];
  warnings: string[];
  evidence: string[];
};

export default function MatchingManager() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [tenderId, setTenderId] = useState("");
  const [candidateKind, setCandidateKind] = useState<"company" | "association">("company");
  const [candidateId, setCandidateId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);

  const candidates = useMemo(() => candidateKind === "company" ? companies : associations, [candidateKind, companies, associations]);

  useEffect(() => { void loadOptions(); }, []);

  async function loadOptions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/matching", { cache: "no-store" });
      const data = await readJson<{ error?: string; tenders?: Tender[]; companies?: Company[]; associations?: Association[] }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca datele pentru matching.");
      setTenders(data.tenders ?? []);
      setCompanies(data.companies ?? []);
      setAssociations(data.associations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut incarca datele pentru matching.");
    } finally {
      setLoading(false);
    }
  }

  async function runMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId, candidateKind, candidateId }),
      });
      const data = await readJson<{ error?: string; result?: MatchResult }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut calcula matching-ul.");
      setResult(data.result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut calcula matching-ul.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={layoutStyle}>
      <form onSubmit={runMatch} style={panelStyle}>
        <div style={kickerStyle}>MATCHING MVP</div>
        <h1 style={titleStyle}>Licitație vs companie/asociere</h1>
        <p style={mutedStyle}>Scoring determinist pe CPV, CAEN, experiență similară și structură. Nu este încă analiză completă de documentație.</p>

        {error && <div style={errorStyle}>{error}</div>}
        {loading && <div style={emptyStyle}>Încarc opțiunile...</div>}

        <label style={fieldStyle}>
          <span style={labelStyle}>Licitație</span>
          <select value={tenderId} onChange={(event) => setTenderId(event.currentTarget.value)} required style={inputStyle}>
            <option value="">Selectează licitație</option>
            {tenders.map((tender) => <option key={tender.id} value={tender.id}>{tender.nume} {tender.referinta ? `(${tender.referinta})` : ""}</option>)}
          </select>
        </label>

        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Tip candidat</span>
            <select value={candidateKind} onChange={(event) => { setCandidateKind(event.currentTarget.value as "company" | "association"); setCandidateId(""); }} style={inputStyle}>
              <option value="company">Companie</option>
              <option value="association">Asociere</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Candidat</span>
            <select value={candidateId} onChange={(event) => setCandidateId(event.currentTarget.value)} required style={inputStyle}>
              <option value="">Selectează candidat</option>
              {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </label>
        </div>

        <button type="submit" disabled={busy || loading} style={buttonStyle}>{busy ? "Calculez..." : "Calculează matching"}</button>
      </form>

      <section style={panelStyle}>
        <div style={kickerStyle}>REZULTAT</div>
        {!result && <div style={emptyStyle}>Alege licitația și candidatul. Momentan sistemul nu visează singur scoruri, ceea ce e sănătos.</div>}
        {result && (
          <div>
            <h2 style={titleStyle}>Scor general: {result.scores.overall}/100</h2>
            <div style={badgeStyle}>{labelRecommendation(result.recommendation)}</div>
            <div style={scoreGridStyle}>
              <Score label="CPV" value={result.scores.cpv} />
              <Score label="CAEN" value={result.scores.caen} />
              <Score label="Experiență" value={result.scores.similar_experience} />
              <Score label="Structură" value={result.scores.structure} />
              <Score label="Documente" value={result.scores.documents} />
            </div>
            <List title="Puncte acoperite" items={result.strengths} empty="Nu există puncte acoperite evidente." tone="ok" />
            <List title="Avertizări" items={result.warnings} empty="Nu există avertizări." tone="warn" />
            <List title="Dovezi folosite" items={result.evidence} empty="Nu există dovezi listate." tone="plain" />
          </div>
        )}
      </section>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return <div style={scoreStyle}><strong>{value}</strong><span>{label}</span></div>;
}

function List({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "ok" | "warn" | "plain" }) {
  const style = tone === "ok" ? okItemStyle : tone === "warn" ? warnItemStyle : plainItemStyle;
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      {items.length ? <div style={{ display: "grid", gap: 8 }}>{items.map((item) => <div key={item} style={style}>{item}</div>)}</div> : <div style={emptyStyle}>{empty}</div>}
    </div>
  );
}

function labelRecommendation(value: string) {
  const labels: Record<string, string> = {
    bid: "Depune",
    bid_with_warnings: "Depune cu risc",
    needs_clarification: "Cere clarificări",
    do_not_bid: "Nu depune",
  };
  return labels[value] ?? value;
}

async function readJson<T>(response: Response): Promise<T> {
  try { return (await response.json()) as T; } catch { return {} as T; }
}

const layoutStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(320px, 460px) minmax(320px, 1fr)", gap: 16, alignItems: "start" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#2f6f6a", fontWeight: 700, letterSpacing: ".08em" };
const titleStyle: CSSProperties = { fontSize: 18, color: "#16324f", margin: "6px 0 4px" };
const sectionTitleStyle: CSSProperties = { fontSize: 15, color: "#16324f", margin: "0 0 10px" };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", marginTop: 4 };
const fieldStyle: CSSProperties = { display: "grid", gap: 5, marginTop: 14 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const inputStyle: CSSProperties = { border: "1px solid #cfd7df", borderRadius: 8, padding: "10px 11px", fontSize: 13, width: "100%" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 };
const scoreGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginTop: 14 };
const scoreStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 10, display: "grid", gap: 4, color: "#16324f" };
const buttonStyle: CSSProperties = { border: "none", borderRadius: 8, padding: "10px 13px", background: "#16324f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 16 };
const emptyStyle: CSSProperties = { border: "1px dashed #cfd7df", borderRadius: 8, padding: 12, color: "#5a6573", fontSize: 13, marginTop: 14 };
const errorStyle: CSSProperties = { border: "1px solid #f3b1aa", background: "#fff4f2", color: "#b3261e", borderRadius: 8, padding: 10, marginTop: 12, fontSize: 13 };
const badgeStyle: CSSProperties = { display: "inline-block", fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: "#eef6f5", color: "#2f6f6a", marginTop: 8 };
const okItemStyle: CSSProperties = { border: "1px solid #b7dfc8", background: "#f1fbf5", color: "#2e7d52", borderRadius: 8, padding: 10, fontSize: 13 };
const warnItemStyle: CSSProperties = { border: "1px solid #f3d19c", background: "#fff8ec", color: "#8a5a00", borderRadius: 8, padding: 10, fontSize: 13 };
const plainItemStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 10, fontSize: 13, color: "#5a6573" };
