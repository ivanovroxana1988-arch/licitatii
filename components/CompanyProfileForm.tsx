"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { CompanyProfile } from "@/lib/company-profile";

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

const DOCUMENTS = [
  ["certificat_constatator", "Certificat constatator ONRC"],
  ["certificat_fiscal", "Certificat fiscal"],
  ["certificat_beneficiar_real", "Dovada beneficiar real"],
  ["imputernicire", "Imputernicire semnatar"],
  ["portofoliu_contracte", "Portofoliu contracte similare"],
] as const;

export default function CompanyProfileForm() {
  const [profile, setProfile] = useState<CompanyProfile>({ declaratii_json: {}, documente_json: {} });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/companie/profil", { cache: "no-store" });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut citi profilul companiei.");
      setProfile(data.profil ?? { declaratii_json: {}, documente_json: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut citi profilul companiei.");
    } finally {
      setLoading(false);
    }
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
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva profilul companiei.");
      setProfile(data.profil ?? profile);
      setMessage("Profilul companiei a fost salvat. Mic miracol administrativ, fara stampila.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva profilul companiei.");
    } finally {
      setBusy(false);
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
        Completeaza o singura data datele firmei. Apoi aplicatia le poate folosi pentru formulare, declaratii si campuri repetitive din fiecare specificatie tehnica. Adica mai putin copy-paste ritualic, acest sport national al achizitiilor.
      </p>

      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={okStyle}>{message}</div>}

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

      <section style={subPanelStyle}>
        <h2 style={sectionTitleStyle}>Documente existente in profil</h2>
        <p style={mutedStyle}>Momentan bifam existenta documentului. Upload PDF pe profil poate veni in pasul urmator, ca sa nu transformam totul intr-un mamut cu picioare de sticla.</p>
        <div style={checkGridStyle}>
          {DOCUMENTS.map(([key, label]) => (
            <label key={key} style={checkStyle}>
              <input
                type="checkbox"
                checked={Boolean(profile.documente_json?.[key])}
                onChange={(event) => updateFlag("documente_json", key, event.currentTarget.checked)}
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

async function readApiResponse(res: Response): Promise<{ error?: string; profil?: CompanyProfile | null }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await res.json();
  const text = await res.text();
  return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || `Serverul a raspuns cu status ${res.status}.` };
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 18, display: "grid", gap: 14 };
const subPanelStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 13, display: "grid", gap: 10 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 };
const checkGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 };
const fieldStyle: CSSProperties = { display: "grid", gap: 6 };
const checkStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "start", fontSize: 13, color: "#394554" };
const inputStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: "9px 10px", fontSize: 13 };
const textareaStyle: CSSProperties = { ...inputStyle, resize: "vertical" };
const buttonStyle: CSSProperties = { justifySelf: "start", border: "none", borderRadius: 8, padding: "10px 14px", background: "#16324f", color: "#fff", fontWeight: 700, fontSize: 13 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { fontSize: 22, color: "#16324f", margin: 0 };
const sectionTitleStyle: CSSProperties = { fontSize: 15, color: "#16324f", margin: 0 };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", lineHeight: 1.5, margin: 0 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const errorStyle: CSSProperties = { border: "1px solid #f1b5ae", background: "#fff7f6", color: "#b3261e", borderRadius: 8, padding: 11, fontSize: 13 };
const okStyle: CSSProperties = { border: "1px solid #b7dfc8", background: "#f2fbf6", color: "#2e7d52", borderRadius: 8, padding: 11, fontSize: 13 };
