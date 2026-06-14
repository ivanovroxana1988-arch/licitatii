"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

export default function AdminLicitatieActions({ licitatieId }: { licitatieId: string }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createInvite() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/invitatii`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu am putut crea invitatia.");
      setLink(data.link);
      if (navigator.clipboard) await navigator.clipboard.writeText(data.link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut crea invitatia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Link href={`/admin/licitatii/${licitatieId}`} style={linkButtonStyle}>
          Deschide licitatia
        </Link>
        <Link href={`/admin/licitatii/${licitatieId}/formular`} style={linkButtonStyle}>
          Configureaza formular
        </Link>
        <button type="button" onClick={createInvite} disabled={busy} style={buttonStyle}>
          {busy ? "Se creeaza..." : "Invita formator"}
        </button>
      </div>
      {link && (
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          style={{ width: "100%", minWidth: 260, padding: "7px 9px", border: "1px solid #dde3ea", borderRadius: 7, fontSize: 12 }}
        />
      )}
      {error && <div style={{ color: "#b3261e", fontSize: 12 }}>{error}</div>}
    </div>
  );
}

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: 7,
  padding: "8px 11px",
  background: "#16324f",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
};

const linkButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#fff",
  color: "#2f6f6a",
  border: "1px solid #2f6f6a",
  textDecoration: "none",
};
