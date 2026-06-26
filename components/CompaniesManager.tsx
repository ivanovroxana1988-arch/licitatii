"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Company = {
  id: string;
  name: string;
  cui?: string | null;
  registration_no?: string | null;
  legal_form?: string | null;
  address?: string | null;
  representative_name?: string | null;
  representative_role?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  caen_codes?: string[] | null;
  cpv_codes?: string[] | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type CompanyForm = {
  name: string;
  cui: string;
  registration_no: string;
  legal_form: string;
  address: string;
  representative_name: string;
  representative_role: string;
  email: string;
  phone: string;
  website: string;
  caen_codes: string;
  cpv_codes: string;
  notes: string;
};

const emptyForm: CompanyForm = {
  name: "",
  cui: "",
  registration_no: "",
  legal_form: "",
  address: "",
  representative_name: "",
  representative_role: "",
  email: "",
  phone: "",
  website: "",
  caen_codes: "",
  cpv_codes: "",
  notes: "",
};

export default function CompaniesManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedId) ?? null,
    [companies, selectedId]
  );

  useEffect(() => {
    void loadCompanies();
  }, []);

  async function loadCompanies(query = search) {
    setLoading(true);
    setError(null);
    try {
      const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/admin/companii${suffix}`, { cache: "no-store" });
      const data = await readJson<{ error?: string; companies?: Company[] }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca lista de companii.");
      setCompanies(data.companies ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut incarca lista de companii.");
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setSelectedId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  }

  function startEdit(company: Company) {
    setSelectedId(company.id);
    setForm(toForm(company));
    setMessage(null);
    setError(null);
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const isEdit = Boolean(selectedId);
      const res = await fetch(isEdit ? `/api/admin/companii/${selectedId}` : "/api/admin/companii", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readJson<{ error?: string; company?: Company }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva compania.");

      await loadCompanies();
      if (data.company) {
        setSelectedId(data.company.id);
        setForm(toForm(data.company));
      }
      setMessage(isEdit ? "Compania a fost actualizata." : "Compania a fost creata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva compania.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCompany(company: Company) {
    const confirmed = window.confirm(`Stergi compania ${company.name}? Documentele si experienta legate de ea pot fi afectate.`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/companii/${company.id}`, { method: "DELETE" });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut sterge compania.");
      if (selectedId === company.id) startCreate();
      await loadCompanies();
      setMessage("Compania a fost stearsa.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut sterge compania.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={layoutStyle}>
      <section style={panelStyle}>
        <div style={kickerStyle}>COMPANII</div>
        <h1 style={titleStyle}>Profile salvate</h1>
        <p style={mutedStyle}>Aici incepe produsul: una sau mai multe companii, apoi asociere, apoi matching cu licitatia.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void loadCompanies(search);
          }}
          style={searchRowStyle}
        >
          <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Cauta dupa denumire, CUI sau nr. ONRC" style={inputStyle} />
          <button type="submit" style={secondaryButtonStyle}>Cauta</button>
          <button type="button" onClick={startCreate} style={buttonStyle}>Companie noua</button>
        </form>

        {loading && <div style={emptyStyle}>Incarc companiile...</div>}
        {!loading && !companies.length && <div style={emptyStyle}>Nu exista companii salvate inca. In mod socant, baza de date nu ghiceste singura.</div>}

        <div style={listStyle}>
          {companies.map((company) => (
            <article key={company.id} style={company.id === selectedId ? selectedCardStyle : cardStyle}>
              <div>
                <strong style={{ color: "#16324f" }}>{company.name}</strong>
                <div style={mutedStyle}>{company.cui || "CUI lipsa"} {company.registration_no ? `- ${company.registration_no}` : ""}</div>
                <div style={tagRowStyle}>
                  {(company.caen_codes ?? []).slice(0, 3).map((code) => <span key={code} style={tagStyle}>CAEN {code}</span>)}
                  {(company.cpv_codes ?? []).slice(0, 3).map((code) => <span key={code} style={tagStyle}>CPV {code}</span>)}
                </div>
              </div>
              <div style={cardActionsStyle}>
                <button type="button" onClick={() => startEdit(company)} style={miniButtonStyle}>Editeaza</button>
                <button type="button" onClick={() => void removeCompany(company)} style={dangerButtonStyle}>Sterge</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form onSubmit={saveCompany} style={panelStyle}>
        <div style={kickerStyle}>{selectedCompany ? "EDITARE" : "COMPANIE NOUA"}</div>
        <h2 style={titleStyle}>{selectedCompany ? selectedCompany.name : "Date companie"}</h2>
        <p style={mutedStyle}>Completeaza datele care vor alimenta asocierea, radarul SEAP si dosarul.</p>

        {error && <div style={errorStyle}>{error}</div>}
        {message && <div style={okStyle}>{message}</div>}

        <div style={gridStyle}>
          <Field label="Denumire companie" value={form.name} required onChange={(value) => setFormField("name", value)} />
          <Field label="CUI / CIF" value={form.cui} onChange={(value) => setFormField("cui", value)} />
          <Field label="Nr. ONRC" value={form.registration_no} onChange={(value) => setFormField("registration_no", value)} />
          <Field label="Forma juridica" value={form.legal_form} onChange={(value) => setFormField("legal_form", value)} />
          <Field label="Reprezentant legal" value={form.representative_name} onChange={(value) => setFormField("representative_name", value)} />
          <Field label="Functie reprezentant" value={form.representative_role} onChange={(value) => setFormField("representative_role", value)} />
          <Field label="Email" value={form.email} onChange={(value) => setFormField("email", value)} />
          <Field label="Telefon" value={form.phone} onChange={(value) => setFormField("phone", value)} />
          <Field label="Website" value={form.website} onChange={(value) => setFormField("website", value)} />
          <Field label="Sediu" value={form.address} textarea onChange={(value) => setFormField("address", value)} />
          <Field label="Coduri CAEN relevante" value={form.caen_codes} textarea hint="Un cod pe linie sau separate prin virgula" onChange={(value) => setFormField("caen_codes", value)} />
          <Field label="Coduri CPV relevante" value={form.cpv_codes} textarea hint="Un cod pe linie sau separate prin virgula" onChange={(value) => setFormField("cpv_codes", value)} />
          <Field label="Note" value={form.notes} textarea onChange={(value) => setFormField("notes", value)} />
        </div>

        <div style={formActionsStyle}>
          <button type="submit" disabled={busy} style={buttonStyle}>{busy ? "Salvez..." : selectedCompany ? "Salveaza modificarile" : "Creeaza compania"}</button>
          <button type="button" onClick={startCreate} style={secondaryButtonStyle}>Curata formularul</button>
        </div>
      </form>
    </div>
  );

  function setFormField(key: keyof CompanyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
}

function Field({ label, value, onChange, required, textarea, hint }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; textarea?: boolean; hint?: string }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {textarea ? (
        <textarea value={value} required={required} onChange={(event) => onChange(event.currentTarget.value)} rows={4} style={textareaStyle} />
      ) : (
        <input value={value} required={required} onChange={(event) => onChange(event.currentTarget.value)} style={inputStyle} />
      )}
      {hint && <small style={mutedStyle}>{hint}</small>}
    </label>
  );
}

function toForm(company: Company): CompanyForm {
  return {
    name: company.name ?? "",
    cui: company.cui ?? "",
    registration_no: company.registration_no ?? "",
    legal_form: company.legal_form ?? "",
    address: company.address ?? "",
    representative_name: company.representative_name ?? "",
    representative_role: company.representative_role ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    website: company.website ?? "",
    caen_codes: (company.caen_codes ?? []).join("\n"),
    cpv_codes: (company.cpv_codes ?? []).join("\n"),
    notes: company.notes ?? "",
  };
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

const layoutStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 420px) minmax(320px, 1fr)", gap: 16, alignItems: "start" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#2f6f6a", fontWeight: 700, letterSpacing: ".08em" };
const titleStyle: CSSProperties = { fontSize: 18, color: "#16324f", margin: "6px 0 4px" };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", marginTop: 4 };
const searchRowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 };
const listStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 14 };
const cardStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" };
const selectedCardStyle: CSSProperties = { ...cardStyle, borderColor: "#2f6f6a", background: "#f3fbf8" };
const cardActionsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };
const tagRowStyle: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 };
const tagStyle: CSSProperties = { borderRadius: 999, background: "#eef6f5", color: "#2f6f6a", padding: "3px 8px", fontSize: 11, fontWeight: 700 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 14 };
const fieldStyle: CSSProperties = { display: "grid", gap: 5 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const inputStyle: CSSProperties = { border: "1px solid #cfd7df", borderRadius: 8, padding: "10px 11px", fontSize: 13, width: "100%" };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 88, resize: "vertical" };
const buttonStyle: CSSProperties = { border: "none", borderRadius: 8, padding: "10px 13px", background: "#16324f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, border: "1px solid #2f6f6a", background: "#fff", color: "#2f6f6a" };
const miniButtonStyle: CSSProperties = { ...secondaryButtonStyle, padding: "7px 9px", fontSize: 12 };
const dangerButtonStyle: CSSProperties = { ...miniButtonStyle, borderColor: "#b3261e", color: "#b3261e" };
const formActionsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 };
const emptyStyle: CSSProperties = { border: "1px dashed #cfd7df", borderRadius: 8, padding: 12, color: "#5a6573", fontSize: 13, marginTop: 14 };
const errorStyle: CSSProperties = { border: "1px solid #f3b1aa", background: "#fff4f2", color: "#b3261e", borderRadius: 8, padding: 10, marginTop: 12, fontSize: 13 };
const okStyle: CSSProperties = { border: "1px solid #b7dfc8", background: "#f1fbf5", color: "#2e7d52", borderRadius: 8, padding: 10, marginTop: 12, fontSize: 13 };
