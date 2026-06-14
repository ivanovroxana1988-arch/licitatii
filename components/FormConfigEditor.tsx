"use client";

import { useMemo, useState } from "react";
import { defaultFormularConfig, type FormularConfig } from "@/lib/form-schema";
import type { Factor } from "@/lib/scoring";

export default function FormConfigEditor({ licitatieId, initialConfig, factori }: { licitatieId: string; initialConfig: FormularConfig; factori: Factor[] }) {
  const [text, setText] = useState(() => JSON.stringify(initialConfig, null, 2));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => { try { return JSON.parse(text) as FormularConfig; } catch { return null; } }, [text]);
  async function save() {
    setBusy(true); setErr(""); setMsg("");
    try {
      if (!parsed) throw new Error("JSON invalid.");
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/formular`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formular_config_json: parsed }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva formularul.");
      setText(JSON.stringify(data.formular_config_json, null, 2));
      setMsg("Formularul a fost salvat.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Nu am putut salva formularul."); }
    finally { setBusy(false); }
  }
  function addDynamicField() {
    const cfg = parsed ?? defaultFormularConfig;
    const next = structuredClone(cfg);
    next.sections[0]?.fields.push({ id: `camp-${crypto.randomUUID().slice(0, 8)}`, label: "Camp nou", type: "text", source: "dynamic", required: false });
    setText(JSON.stringify(next, null, 2));
  }
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
    <section style={card}><h2 style={h2}>Configuratie formular</h2><p style={muted}>Editeaza sectiunile si campurile in JSON. Campurile dinamice se salveaza in aplicare, iar scoring.factorCod le poate lega de factori.</p><textarea value={text} onChange={e => setText(e.target.value)} rows={28} spellCheck={false} style={textarea} /></section>
    <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <section style={card}><h2 style={h2}>Actiuni</h2><button onClick={save} disabled={busy || !parsed} style={primary}>{busy ? "Se salveaza..." : "Salveaza configuratia"}</button><button onClick={addDynamicField} style={secondary}>Adauga rapid camp text</button><button onClick={() => setText(JSON.stringify(defaultFormularConfig, null, 2))} style={secondary}>Revino la standard</button>{!parsed && <p style={error}>JSON invalid.</p>}</section>
      {msg && <div style={ok}>{msg}</div>}{err && <div style={errorBox}>{err}</div>}
      <section style={card}><h2 style={h2}>Factori</h2>{factori.map(f => <p key={f.id} style={muted}><b>{f.cod}</b> {f.denumire}</p>)}</section>
      <section style={card}><h2 style={h2}>Exemplu camp dinamic</h2><pre style={pre}>{`{
  "id": "ani_experienta",
  "label": "Ani experienta",
  "type": "number",
  "source": "dynamic",
  "required": true,
  "scoring": { "factorCod": "F2.3", "mode": "value" }
}`}</pre></section>
    </aside>
  </div>;
}
const card = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const h2 = { color: "#16324f", fontSize: 16, marginBottom: 8 };
const muted = { color: "#5a6573", fontSize: 13, lineHeight: 1.45 };
const textarea = { width: "100%", marginTop: 12, border: "1px solid #dde3ea", borderRadius: 8, padding: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 };
const primary = { width: "100%", border: "none", borderRadius: 8, padding: 11, background: "#16324f", color: "#fff", fontWeight: 700 };
const secondary = { width: "100%", marginTop: 10, border: "1px solid #2f6f6a", borderRadius: 8, padding: 10, background: "#fff", color: "#2f6f6a", fontWeight: 700 };
const ok = { ...card, color: "#1a7f37", background: "#f1faf4" };
const errorBox = { ...card, color: "#b3261e", background: "#fff7f6" };
const error = { color: "#b3261e", fontSize: 13, marginTop: 10 };
const pre = { background: "#f6f8fb", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 12 };
