"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  factorScore,
  isEligible,
  pointsForFormator,
  priceScore,
  rawValueForFactor,
  technicalTotal,
  type Criteriu,
  type Factor,
  type Formator,
} from "@/lib/scoring";

export type AdminAplicare = {
  id: string;
  status: string;
  selectat: boolean;
  token: string;
  formator: {
    id: string;
    nume?: string | null;
    prenume?: string | null;
    email?: string | null;
    domeniu_studii?: string | null;
    are_cor_242401?: boolean | null;
    raspunsuri_formular_json?: Record<string, unknown>;
  } | null;
  contracte: {
    organizatie: string;
    structura_complexa: boolean;
    ore: number;
    nr_tematici: number;
  }[];
};

type Props = {
  licitatie: {
    id: string;
    nume: string;
    referinta?: string | null;
    beneficiar?: string | null;
    pondere_pret?: number | null;
    status?: string | null;
  };
  factori: Factor[];
  criterii: Criteriu[];
  aplicari: AdminAplicare[];
};

export default function LicitatieAdminPanel({ licitatie, factori, criterii, aplicari }: Props) {
  const [rows, setRows] = useState(aplicari);
  const [myPrice, setMyPrice] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFormators = useMemo(
    () => rows.filter((row) => row.selectat).map(toScoringFormator),
    [rows]
  );
  const technical = useMemo(() => technicalTotal(factori, selectedFormators), [factori, selectedFormators]);
  const factorBreakdown = useMemo(
    () =>
      factori.map((factor) => ({
        factor,
        value: factorScore(factor, selectedFormators),
      })),
    [factori, selectedFormators]
  );
  const maxTechnical = factori.reduce((total, factor) => total + Number(factor.punctaj_max || 0), 0);
  const priceMax = Number(licitatie.pondere_pret ?? 0);
  const price = priceScore(Number(myPrice), Number(competitorPrice), priceMax);
  const blocker = factorBreakdown
    .map((item) => ({
      ...item,
      missing: Math.max(0, Number(item.factor.punctaj_max || 0) - item.value),
    }))
    .sort((a, b) => b.missing - a.missing)[0];

  async function setSelected(id: string, selectat: boolean) {
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, selectat } : row)));
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/aplicari/${id}/selectie`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva selectia.");
    } catch (err) {
      setRows(previous);
      setError(err instanceof Error ? err.message : "Nu am putut salva selectia.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && <div style={errorStyle}>{error}</div>}

      <section style={summaryGridStyle}>
        <div style={panelStyle}>
          <div style={kickerStyle}>ECHIPA SELECTATA</div>
          <div style={scoreStyle}>{technical} / {maxTechnical}</div>
          <div style={mutedStyle}>punctaj tehnic curent</div>
        </div>
        <div style={panelStyle}>
          <div style={kickerStyle}>SELECTATI</div>
          <div style={scoreStyle}>{selectedFormators.length}</div>
          <div style={mutedStyle}>din {rows.length} aplicari</div>
        </div>
        <div style={panelStyle}>
          <div style={kickerStyle}>SIMULATOR PRET</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <Input label="Pretul nostru" value={myPrice} onChange={setMyPrice} />
            <Input label="Pret concurenta" value={competitorPrice} onChange={setCompetitorPrice} />
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "#394554" }}>
            Pret: <strong>{price}</strong> / {priceMax}; total simulat: <strong>{Math.round((technical + price) * 100) / 100}</strong>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={sectionTitleStyle}>Defalcare scor echipa</h2>
          <div style={mutedStyle}>
            {blocker?.missing
              ? `Ce te tine pe loc: ${blocker.factor.cod} mai poate aduce ${blocker.missing} puncte.`
              : "Factorii selectati sunt la maximumul configurat."}
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {factorBreakdown.map(({ factor, value }) => {
            const max = Number(factor.punctaj_max || 0);
            const pct = max ? Math.min(100, (value / max) * 100) : 0;
            return (
              <div key={factor.id} style={{ display: "grid", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <strong>{factor.cod} - {factor.denumire}</strong>
                  <span>{value} / {max}</span>
                </div>
                <div style={barTrackStyle}>
                  <div style={{ ...barFillStyle, width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Aplicari formatori</h2>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {rows.map((row) => {
            const formator = toScoringFormator(row);
            const eligibility = isEligible(formator, criterii, factori);
            const name = [row.formator?.prenume, row.formator?.nume].filter(Boolean).join(" ") || "Formator invitat";
            return (
              <article key={row.id} style={applicationStyle}>
                <div style={{ display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={toggleStyle}>
                      <input
                        type="checkbox"
                        checked={row.selectat}
                        disabled={savingId === row.id || row.status !== "finalizat"}
                        onChange={(event) => setSelected(row.id, event.target.checked)}
                      />
                      Selectat
                    </label>
                    <strong style={{ color: "#16324f" }}>{name}</strong>
                    <span style={statusStyle}>{statusLabel(row.status)}</span>
                    <span style={eligibility.ok ? okBadgeStyle : warnBadgeStyle}>
                      {eligibility.ok ? "Eligibil" : "Neeligibil"}
                    </span>
                  </div>
                  <div style={mutedStyle}>
                    {row.formator?.email ?? `/aplica/${row.token}`}
                  </div>
                  {!eligibility.ok && (
                    <div style={{ fontSize: 12, color: "#8a5a00" }}>
                      {eligibility.details.filter((detail) => !detail.ok).map((detail) => detail.eticheta).join("; ")}
                    </div>
                  )}
                </div>
                <div style={pointsGridStyle}>
                  {factori.map((factor) => (
                    <div key={factor.id} style={pointCellStyle}>
                      <span style={kickerStyle}>{factor.cod}</span>
                      <strong>{pointsForFormator(factor, formator)}</strong>
                      <small style={mutedStyle}>{formatRawValue(rawValueForFactor(factor, formator))}</small>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function toScoringFormator(row: AdminAplicare): Formator {
  return {
    id: row.formator?.id ?? row.id,
    nume: row.formator?.nume ?? "",
    prenume: row.formator?.prenume ?? "",
    domeniu_studii: row.formator?.domeniu_studii ?? "",
    are_cor_242401: !!row.formator?.are_cor_242401,
    raspunsuri_formular_json: row.formator?.raspunsuri_formular_json ?? {},
    contracte: row.contracte,
  };
}

function Input(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={labelStyle}>{props.label}</span>
      <input
        type="number"
        min={0}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function statusLabel(status: string) {
  if (status === "finalizat") return "Finalizat";
  if (status === "in_completare") return "In completare";
  return "Invitat";
}

function formatRawValue(value: number | string | boolean) {
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  return value || "-";
}

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: 16,
};

const applicationStyle: CSSProperties = {
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 12,
};

const pointsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
};

const pointCellStyle: CSSProperties = {
  border: "1px solid #eef2f6",
  borderRadius: 7,
  padding: 9,
  display: "grid",
  gap: 3,
};

const scoreStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 28,
  color: "#16324f",
  fontWeight: 700,
  marginTop: 5,
};

const kickerStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  color: "#5a6573",
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 16,
  color: "#16324f",
  margin: 0,
};

const mutedStyle: CSSProperties = {
  color: "#5a6573",
  fontSize: 12,
};

const labelStyle: CSSProperties = {
  color: "#5a6573",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #dde3ea",
  borderRadius: 7,
  padding: "8px 9px",
  fontSize: 13,
};

const toggleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 13,
  fontWeight: 700,
  color: "#16324f",
};

const statusStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 9px",
  borderRadius: 999,
  background: "#f6f8fb",
  color: "#394554",
};

const okBadgeStyle: CSSProperties = {
  ...statusStyle,
  background: "#e6f4ec",
  color: "#2e7d52",
};

const warnBadgeStyle: CSSProperties = {
  ...statusStyle,
  background: "#fff3e0",
  color: "#8a5a00",
};

const errorStyle: CSSProperties = {
  border: "1px solid #f1b5ae",
  borderRadius: 8,
  padding: 12,
  background: "#fff7f6",
  color: "#b3261e",
  fontSize: 13,
};

const barTrackStyle: CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: "#eef2f6",
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "#2f6f6a",
};
