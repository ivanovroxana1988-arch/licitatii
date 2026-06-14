"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminLicitatieActions({ licitatieId }: { licitatieId: string }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function createInvite() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/invitatii`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu am putut crea invitatia.");
      setLink(data.link);
      await navigator.clipboard?.writeText(data.link);
    } catch (e) { setError(e instanceof Error ? e.message : "Nu am putut crea invitatia."); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <Link href={`/admin/licitatii/${licitatieId}/formular`} style={linkBtn}>Configureaza formular</Link>
      <button type="button" onClick={createInvite} disabled={busy} style={btn}>{busy ? "Se creeaza..." : "Invita formator"}</button>
    </div>
    {link && <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%", minWidth: 260, padding: 7, border: "1px solid #dde3ea", borderRadius: 7, fontSize: 12 }} />}
    {error && <div style={{ color: "#b3261e", fontSize: 12 }}>{error}</div>}
  </div>;
}
const btn = { border: "none", borderRadius: 7, padding: "8px 11px", background: "#16324f", color: "#fff", fontWeight: 700, fontSize: 12 };
const linkBtn = { ...btn, background: "#fff", color: "#2f6f6a", border: "1px solid #2f6f6a", textDecoration: "none" };
