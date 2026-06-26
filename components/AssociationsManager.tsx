"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Company = { id: string; name: string; cui?: string | null };
type AssociationMember = {
  company_id: string;
  role?: string | null;
  responsibility?: string | null;
  share_percent?: number | string | null;
  is_leader?: boolean;
  company?: Company | null;
};
type Association = {
  id: string;
  name: string;
  leader_company_id?: string | null;
  purpose?: string | null;
  notes?: string | null;
  leader?: Company | null;
  members?: AssociationMember[] | null;
};
type AssociationForm = {
  name: string;
  leader_company_id: string;
  purpose: string;
  notes: string;
  members: AssociationMember[];
};

const emptyForm: AssociationForm = { name: "", leader_company_id: "", purpose: "", notes: "", members: [] };

export default function AssociationsManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [form, setForm] = useState<AssociationForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [companyToAdd, setCompanyToAdd] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAssociation = useMemo(
    () => associations.find((item) => item.id === selectedId) ?? null,
    [associations, selectedId]
  );

  const selectedMemberIds = useMemo(() => new Set(form.members.map((member) => member.company_id)), [form.members]);
  const availableCompanies = companies.filter((company) => !selectedMemberIds.has(company.id));
  const totalShare = form.members.reduce((sum, member) => sum + (Number(member.share_percent) || 0), 0);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCompanies(), loadAssociations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut incarca datele pentru asocieri.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    const res = await fetch("/api/admin/companii", { cache: "no-store" });
    const data = await readJson<{ error?: string; companies?: Company[] }>(res);
    if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca firmele.");
    setCompanies(data.companies ?? []);
  }

  async function loadAssociations() {
    const res = await fetch("/api/admin/asocieri", { cache: "no-store" });
    const data = await readJson<{ error?: string; associations?: Association[] }>(res);
    if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca asocierile.");
    setAssociations(data.associations ?? []);
  }

  function startCreate() {
    setSelectedId(null);
    setForm(emptyForm);
    setCompanyToAdd("");
    setMessage(null);
    setError(null);
  }

  function startEdit(association: Association) {
    const members = (association.members ?? []).map((member) => ({
      company_id: member.company_id,
      role: member.role ?? "",
      responsibility: member.responsibility ?? "",
      share_percent: member.share_percent ?? "",
      is_leader: Boolean(member.is_leader),
      company: member.company ?? null,
    }));

    setSelectedId(association.id);
    setForm({
      name: association.name ?? "",
      leader_company_id: association.leader_company_id ?? members.find((member) => member.is_leader)?.company_id ?? "",
      purpose: association.purpose ?? "",
      notes: association.notes ?? "",
      members,
    });
    setCompanyToAdd("");
    setMessage(null);
    setError(null);
  }

  function addCompany() {
    if (!companyToAdd || selectedMemberIds.has(companyToAdd)) return;
    const company = companies.find((item) => item.id === companyToAdd) ?? null;
    const nextMember = { company_id: companyToAdd, role: "", responsibility: "", share_percent: "", is_leader: form.members.length === 0, company };
    setForm((current) => ({
      ...current,
      leader_company_id: current.leader_company_id || companyToAdd,
      members: [...current.members, nextMember],
    }));
    setCompanyToAdd("");
  }

  function removeMember(companyId: string) {
    setForm((current) => {
      const members = current.members.filter((member) => member.company_id !== companyId);
      const leaderStillExists = members.some((member) => member.company_id === current.leader_company_id);
      return {
        ...current,
        leader_company_id: leaderStillExists ? current.leader_company_id : members[0]?.company_id ?? "",
        members: members.map((member, index) => ({ ...member, is_leader: leaderStillExists ? member.company_id === current.leader_company_id : index === 0 })),
      };
    });
  }

  function updateMember(companyId: string, patch: Partial<AssociationMember>) {
    setForm((current) => ({
      ...current,
      members: current.members.map((member) => member.company_id === companyId ? { ...member, ...patch } : member),
    }));
  }

  function setLeader(companyId: string) {
    setForm((current) => ({
      ...current,
      leader_company_id: companyId,
      members: current.members.map((member) => ({ ...member, is_leader: member.company_id === companyId })),
    }));
  }

  async function saveAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        ...form,
        members: form.members.map((member) => ({
          company_id: member.company_id,
          role: member.role ?? "",
          responsibility: member.responsibility ?? "",
          share_percent: member.share_percent ?? "",
          is_leader: member.company_id === form.leader_company_id,
        })),
      };

      const isEdit = Boolean(selectedId);
      const res = await fetch(isEdit ? `/api/admin/asocieri/${selectedId}` : "/api/admin/asocieri", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ error?: string; association?: Association }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva asocierea.");

      await loadAssociations();
      if (data.association) {
        setSelectedId(data.association.id);
        startEdit(data.association);
      }
      setMessage(isEdit ? "Asocierea a fost actualizata." : "Asocierea a fost creata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva asocierea.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAssociation(association: Association) {
    const confirmed = window.confirm(`Stergi asocierea ${association.name}?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/asocieri/${association.id}`, { method: "DELETE" });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Nu am putut sterge asocierea.");
      if (selectedId === association.id) startCreate();
      await loadAssociations();
      setMessage("Asocierea a fost stearsa.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut sterge asocierea.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={layoutStyle}>
      <section style={panelStyle}>
        <div style={kickerStyle}>ASOCIERI</div>
        <h1 style={titleStyle}>Profile de asociere</h1>
        <p style={mutedStyle}>Selecteaza firmele care depun impreuna, liderul si rolul fiecareia.</p>
        <button type="button" onClick={startCreate} style={buttonStyle}>Asociere noua</button>

        {loading && <div style={emptyStyle}>Incarc asocierile...</div>}
        {!loading && !associations.length && <div style={emptyStyle}>Nu exista asocieri salvate. Inca. Birocratia asteapta rabdatoare.</div>}

        <div style={listStyle}>
          {associations.map((association) => (
            <article key={association.id} style={association.id === selectedId ? selectedCardStyle : cardStyle}>
              <div>
                <strong style={{ color: "#16324f" }}>{association.name}</strong>
                <div style={mutedStyle}>Lider: {association.leader?.name ?? "nesetat"}</div>
                <div style={tagRowStyle}>{(association.members ?? []).map((member) => <span key={member.company_id} style={tagStyle}>{member.company?.name ?? member.company_id}</span>)}</div>
              </div>
              <div style={cardActionsStyle}>
                <button type="button" onClick={() => startEdit(association)} style={miniButtonStyle}>Editeaza</button>
                <button type="button" onClick={() => void removeAssociation(association)} style={dangerButtonStyle}>Sterge</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form onSubmit={saveAssociation} style={panelStyle}>
        <div style={kickerStyle}>{selectedAssociation ? "EDITARE" : "ASOCIERE NOUA"}</div>
        <h2 style={titleStyle}>{selectedAssociation ? selectedAssociation.name : "Date asociere"}</h2>
        <p style={mutedStyle}>Acest profil va fi folosit pentru matching cu licitatia si pentru generarea acordului de asociere.</p>

        {error && <div style={errorStyle}>{error}</div>}
        {message && <div style={okStyle}>{message}</div>}

        <div style={gridStyle}>
          <Field label="Denumire asociere" value={form.name} required onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
          <Field label="Scop / tip licitatii" value={form.purpose} onChange={(value) => setForm((current) => ({ ...current, purpose: value }))} />
          <Field label="Note" value={form.notes} textarea onChange={(value) => setForm((current) => ({ ...current, notes: value }))} />
        </div>

        <section style={subPanelStyle}>
          <h3 style={sectionTitleStyle}>Membri asociere</h3>
          <div style={addRowStyle}>
            <select value={companyToAdd} onChange={(event) => setCompanyToAdd(event.currentTarget.value)} style={inputStyle}>
              <option value="">Selecteaza companie</option>
              {availableCompanies.map((company) => <option key={company.id} value={company.id}>{company.name} {company.cui ? `(${company.cui})` : ""}</option>)}
            </select>
            <button type="button" onClick={addCompany} style={secondaryButtonStyle}>Adauga membru</button>
          </div>

          {!companies.length && <div style={emptyStyle}>Nu exista companii. Creeaza intai companii, pentru ca asocierea dintre nimic si nimic e filosofie, nu achizitie.</div>}
          {!form.members.length && companies.length > 0 && <div style={emptyStyle}>Adauga cel putin o companie in asociere.</div>}

          <div style={memberListStyle}>
            {form.members.map((member) => {
              const company = companies.find((item) => item.id === member.company_id) ?? member.company;
              return (
                <article key={member.company_id} style={memberCardStyle}>
                  <div style={memberHeaderStyle}>
                    <div>
                      <strong style={{ color: "#16324f" }}>{company?.name ?? member.company_id}</strong>
                      <div style={mutedStyle}>{company?.cui ?? "CUI lipsa"}</div>
                    </div>
                    <label style={checkStyle}>
                      <input type="radio" name="leader" checked={form.leader_company_id === member.company_id} onChange={() => setLeader(member.company_id)} /> Lider
                    </label>
                  </div>
                  <div style={gridStyle}>
                    <Field label="Rol" value={String(member.role ?? "")} onChange={(value) => updateMember(member.company_id, { role: value })} />
                    <Field label="Procent / pondere" value={String(member.share_percent ?? "")} onChange={(value) => updateMember(member.company_id, { share_percent: value })} />
                    <Field label="Responsabilitate" value={String(member.responsibility ?? "")} textarea onChange={(value) => updateMember(member.company_id, { responsibility: value })} />
                  </div>
                  <button type="button" onClick={() => removeMember(member.company_id)} style={dangerButtonStyle}>Scoate din asociere</button>
                </article>
              );
            })}
          </div>
          {!!form.members.length && <div style={mutedStyle}>Total ponderi completate: {totalShare}%</div>}
        </section>

        <div style={formActionsStyle}>
          <button type="submit" disabled={busy} style={buttonStyle}>{busy ? "Salvez..." : selectedAssociation ? "Salveaza asocierea" : "Creeaza asocierea"}</button>
          <button type="button" onClick={startCreate} style={secondaryButtonStyle}>Curata formularul</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required, textarea }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; textarea?: boolean }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {textarea ? <textarea value={value} required={required} onChange={(event) => onChange(event.currentTarget.value)} rows={4} style={textareaStyle} /> : <input value={value} required={required} onChange={(event) => onChange(event.currentTarget.value)} style={inputStyle} />}
    </label>
  );
}

async function readJson<T>(response: Response): Promise<T> {
  try { return (await response.json()) as T; } catch { return {} as T; }
}

const layoutStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 420px) minmax(320px, 1fr)", gap: 16, alignItems: "start" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const subPanelStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 14, marginTop: 16 };
const kickerStyle: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#2f6f6a", fontWeight: 700, letterSpacing: ".08em" };
const titleStyle: CSSProperties = { fontSize: 18, color: "#16324f", margin: "6px 0 4px" };
const sectionTitleStyle: CSSProperties = { fontSize: 15, color: "#16324f", margin: "0 0 10px" };
const mutedStyle: CSSProperties = { fontSize: 13, color: "#5a6573", marginTop: 4 };
const listStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 14 };
const cardStyle: CSSProperties = { border: "1px solid #eef2f6", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" };
const selectedCardStyle: CSSProperties = { ...cardStyle, borderColor: "#2f6f6a", background: "#f3fbf8" };
const cardActionsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };
const tagRowStyle: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 };
const tagStyle: CSSProperties = { borderRadius: 999, background: "#eef6f5", color: "#2f6f6a", padding: "3px 8px", fontSize: 11, fontWeight: 700 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 12 };
const fieldStyle: CSSProperties = { display: "grid", gap: 5 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const inputStyle: CSSProperties = { border: "1px solid #cfd7df", borderRadius: 8, padding: "10px 11px", fontSize: 13, width: "100%" };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 88, resize: "vertical" };
const buttonStyle: CSSProperties = { border: "none", borderRadius: 8, padding: "10px 13px", background: "#16324f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 12 };
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, border: "1px solid #2f6f6a", background: "#fff", color: "#2f6f6a", marginTop: 0 };
const miniButtonStyle: CSSProperties = { ...secondaryButtonStyle, padding: "7px 9px", fontSize: 12 };
const dangerButtonStyle: CSSProperties = { ...miniButtonStyle, borderColor: "#b3261e", color: "#b3261e", marginTop: 10 };
const emptyStyle: CSSProperties = { border: "1px dashed #cfd7df", borderRadius: 8, padding: 12, color: "#5a6573", fontSize: 13, marginTop: 14 };
const errorStyle: CSSProperties = { border: "1px solid #f3b1aa", background: "#fff4f2", color: "#b3261e", borderRadius: 8, padding: 10, marginTop: 12, fontSize: 13 };
const okStyle: CSSProperties = { border: "1px solid #b7dfc8", background: "#f1fbf5", color: "#2e7d52", borderRadius: 8, padding: 10, marginTop: 12, fontSize: 13 };
const addRowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const memberListStyle: CSSProperties = { display: "grid", gap: 12, marginTop: 12 };
const memberCardStyle: CSSProperties = { border: "1px solid #dde3ea", borderRadius: 8, padding: 12 };
const memberHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const checkStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#16324f", fontWeight: 700 };
const formActionsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 };
