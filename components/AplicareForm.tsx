"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AplicarePayload } from "@/lib/aplicare";
import { DOCUMENT_TYPES, countTopics, documentTypeLabel, getStudyDomainOptions, validateRequiredForm, type AplicareContract, type AplicareFormator, type DocumentTip, type DynamicAnswers, type FormField } from "@/lib/form-schema";
import { isEligible, type Formator } from "@/lib/scoring";

export default function AplicareForm({ token }: { token: string }) {
  const [payload, setPayload] = useState<AplicarePayload | null>(null);
  const [formator, setFormator] = useState<AplicareFormator>({});
  const [contracte, setContracte] = useState<AplicareContract[]>([emptyContract()]);
  const [answers, setAnswers] = useState<DynamicAnswers>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadTip, setUploadTip] = useState<DocumentTip>("recomandare");

  useEffect(() => { fetch(`/api/aplicare/${token}`).then(r => r.json().then(d => ({ ok: r.ok, d }))).then(({ ok, d }) => { if (!ok) throw new Error(d.error); apply(d); }).catch(e => setErr(e.message)); }, [token]);
  const readonly = !!payload?.aplicare.readonly;
  const studyOptions = useMemo(() => getStudyDomainOptions(payload?.factori ?? []), [payload?.factori]);
  const eligibility = useMemo(() => {
    if (!payload) return null;
    const f: Formator = { id: payload.formator.id ?? "draft", nume: formator.nume ?? "", prenume: formator.prenume ?? "", domeniu_studii: formator.domeniu_studii ?? "", are_cor_242401: !!formator.are_cor_242401, raspunsuri_formular_json: answers, contracte: contracte.map(c => ({ organizatie: c.organizatie, structura_complexa: !!c.structura_complexa, ore: Number(c.ore) || 0, nr_tematici: countTopics(c.tematici) })) };
    return isEligible(f, payload.criterii, payload.factori);
  }, [answers, contracte, formator, payload]);

  function apply(data: AplicarePayload) { setPayload(data); setFormator(data.formator); setContracte(data.contracte.length ? data.contracte : [emptyContract()]); setAnswers(data.aplicare.raspunsuri_formular_json ?? {}); }
  async function save() {
    setBusy(true); setErr(""); setMsg("");
    try { const r = await fetch(`/api/aplicare/${token}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formator, contracte, raspunsuri_formular_json: answers }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); apply(d); setMsg("Datele au fost salvate."); return d as AplicarePayload; }
    catch (e) { setErr(e instanceof Error ? e.message : "Nu am putut salva."); return null; }
    finally { setBusy(false); }
  }
  async function upload(file?: File | null) {
    if (!file) return;
    setBusy(true); setErr(""); setMsg("");
    try { if (!payload?.aplicare.formator_id) await save(); const fd = new FormData(); fd.append("file", file); fd.append("tip", uploadTip); const r = await fetch(`/api/aplicare/${token}/documente`, { method: "POST", body: fd }); const d = await r.json(); if (!r.ok) throw new Error(d.error); apply(d); setMsg("Document incarcat."); }
    catch (e) { setErr(e instanceof Error ? e.message : "Nu am putut incarca documentul."); }
    finally { setBusy(false); }
  }
  async function delDoc(id: string) { const r = await fetch(`/api/aplicare/${token}/documente/${id}`, { method: "DELETE" }); const d = await r.json(); if (!r.ok) setErr(d.error); else apply(d); }
  async function finalize() {
    if (!payload) return;
    const local = validateRequiredForm({ config: payload.licitatie.formular_config_json, formator, contracte, answers, documente: payload.documente });
    if (local.length) return setErr(local.join(" "));
    if (!confirm("Finalizezi aplicarea? Dupa finalizare formularul devine doar pentru citire.")) return;
    await save(); const r = await fetch(`/api/aplicare/${token}/finalizare`, { method: "POST" }); const d = await r.json(); if (!r.ok) setErr([d.error, ...(d.details ?? [])].join(" ")); else { apply(d); setMsg("Aplicarea a fost finalizata."); }
  }

  if (err && !payload) return <Shell title="Link invalid"><p>{err}</p></Shell>;
  if (!payload) return <Shell title="Se incarca">Verificam linkul de aplicare.</Shell>;

  return <div style={{ minHeight: "100vh" }}>
    <header style={header}><div><div style={mono}>FORMULAR FORMATOR</div><h1 style={{ fontSize: 22 }}>{payload.licitatie.nume}</h1><p style={{ opacity: .8 }}>{payload.licitatie.referinta} {payload.licitatie.beneficiar}</p></div><b>{payload.aplicare.status}</b></header>
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>{payload.licitatie.formular_config_json.sections.map(s => <section key={s.id} style={card}><h2 style={h2}>{s.title}</h2>{s.description && <p style={muted}>{s.description}</p>}<div style={{ display: "grid", gap: 10, marginTop: 12 }}>{s.fields.map(f => renderField(f))}</div></section>)}</div>
      <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <section style={card}><h2 style={h2}>Eligibilitate</h2>{eligibility?.details.map(d => <div key={d.eticheta} style={{ fontSize: 13, marginTop: 6, color: d.ok ? "#2e7d52" : "#b3261e" }}>{d.ok ? "OK" : "X"} {d.eticheta}</div>)}</section>
        {err && <div style={errorBox}>{err}</div>}{msg && <div style={okBox}>{msg}</div>}
        <section style={card}><button disabled={readonly || busy} onClick={save} style={primary}>{busy ? "Se lucreaza..." : "Salveaza"}</button><button disabled={readonly || busy} onClick={finalize} style={secondary}>Finalizeaza aplicarea</button>{readonly && <p style={muted}>Aplicarea este finalizata.</p>}</section>
      </aside>
    </main>
  </div>;

  function renderField(field: FormField) {
    if (field.type === "contract_list") return <ContractList key={field.id} />;
    if (field.type === "document_upload") return <Documents key={field.id} />;
    const value = getValue(field); const opts = field.optionsSource === "study_domains" ? studyOptions : field.options ?? [];
    return <label key={field.id} style={{ display: "grid", gap: 5 }}><span style={label}>{field.label}{field.required ? " *" : ""}</span>{field.type === "textarea" ? <textarea disabled={readonly} rows={4} value={String(value ?? "")} onChange={e => setValue(field, e.target.value)} style={input} /> : field.type === "select" ? <select disabled={readonly} value={String(value ?? "")} onChange={e => setValue(field, e.target.value)} style={input}><option value="">Alege</option>{opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : field.type === "checkbox" ? <input disabled={readonly} type="checkbox" checked={!!value} onChange={e => setValue(field, e.target.checked)} /> : <input disabled={readonly} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(value ?? "")} onChange={e => setValue(field, field.type === "number" ? Number(e.target.value) : e.target.value)} style={input} />}{field.help && <small>{field.help}</small>}</label>;
  }
  function ContractList() { return <div style={{ display: "grid", gap: 10 }}>{contracte.map((c, i) => <div key={c.id ?? i} style={subcard}><input disabled={readonly} placeholder="Organizatie" value={c.organizatie} onChange={e => patchContract(i, { organizatie: e.target.value })} style={input} /><input disabled={readonly} placeholder="Domeniu organizatie" value={c.domeniu_org ?? ""} onChange={e => patchContract(i, { domeniu_org: e.target.value })} style={input} /><input disabled={readonly} placeholder="Perioada" value={c.perioada ?? ""} onChange={e => patchContract(i, { perioada: e.target.value })} style={input} /><input disabled={readonly} type="number" placeholder="Ore" value={c.ore ?? 0} onChange={e => patchContract(i, { ore: Number(e.target.value) })} style={input} /><label><input disabled={readonly} type="checkbox" checked={!!c.structura_complexa} onChange={e => patchContract(i, { structura_complexa: e.target.checked })} /> Structura complexa</label><textarea disabled={readonly} rows={3} placeholder="Tematici separate prin virgula" value={c.tematici ?? ""} onChange={e => patchContract(i, { tematici: e.target.value })} style={input} /><small>Tematici: {countTopics(c.tematici)}</small>{!readonly && <button onClick={() => setContracte(items => items.length === 1 ? [emptyContract()] : items.filter((_, n) => n !== i))} style={danger}>Sterge</button>}</div>)}{!readonly && <button onClick={() => setContracte(items => [...items, emptyContract()])} style={secondary}>Adauga contract</button>}</div>; }
  function Documents() { const currentPayload = payload; if (!currentPayload) return null; return <div>{!readonly && <div style={{ display: "grid", gap: 8 }}><select value={uploadTip} onChange={e => setUploadTip(e.target.value as DocumentTip)} style={input}>{DOCUMENT_TYPES.map(t => <option key={t} value={t}>{documentTypeLabel(t)}</option>)}</select><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e => upload(e.target.files?.[0])} style={input} /></div>}<div style={{ display: "grid", gap: 8, marginTop: 10 }}>{currentPayload.documente.map(d => <div key={d.id} style={row}><span>{d.nume_fisier}<br /><small>{documentTypeLabel(d.tip)}</small></span>{!readonly && <button onClick={() => delDoc(d.id)} style={danger}>Sterge</button>}</div>)}</div></div>; }
  function getValue(field: FormField) { return field.source === "dynamic" ? answers[field.id] : field.bind ? formator[field.bind as keyof AplicareFormator] : ""; }
  function setValue(field: FormField, value: unknown) { field.source === "dynamic" ? setAnswers(a => ({ ...a, [field.id]: value })) : field.bind && setFormator(f => ({ ...f, [field.bind as keyof AplicareFormator]: value })); }
  function patchContract(i: number, patch: Partial<AplicareContract>) { setContracte(items => items.map((c, n) => n === i ? { ...c, ...patch } : c)); }
}
function Shell({ title, children }: { title: string; children: ReactNode }) { return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}><section style={card}><div style={mono}>FORMULAR FORMATOR</div><h1 style={h2}>{title}</h1>{children}</section></div>; }
function emptyContract(): AplicareContract { return { organizatie: "", domeniu_org: "", structura_complexa: false, perioada: "", ore: 0, tematici: "", nr_tematici: 0 }; }
const header = { background: "#16324f", color: "#fff", padding: 20, display: "flex", justifyContent: "space-between", gap: 16 };
const mono = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: .75, letterSpacing: ".08em" };
const card = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const subcard = { border: "1px solid #dde3ea", borderRadius: 8, padding: 12, display: "grid", gap: 8 };
const row = { border: "1px solid #dde3ea", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", gap: 10 };
const h2 = { fontSize: 16, color: "#16324f" };
const muted = { color: "#5a6573", fontSize: 13 };
const label = { color: "#5a6573", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const };
const input = { width: "100%", border: "1px solid #dde3ea", borderRadius: 7, padding: 9, fontSize: 14 };
const primary = { width: "100%", border: "none", borderRadius: 8, padding: 11, background: "#16324f", color: "#fff", fontWeight: 700 };
const secondary = { marginTop: 8, border: "1px solid #2f6f6a", borderRadius: 8, padding: 10, background: "#fff", color: "#2f6f6a", fontWeight: 700 };
const danger = { border: "1px solid #f1b5ae", borderRadius: 7, padding: 7, background: "#fff7f6", color: "#b3261e" };
const errorBox = { ...card, color: "#b3261e", background: "#fff7f6" };
const okBox = { ...card, color: "#1a7f37", background: "#f1faf4" };
