"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr("Email sau parolă greșite.");
      return;
    }
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5a6573", letterSpacing: ".08em" }}>
            MOTOR DE LICITAȚII
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "#16324f" }}>
            Autentificare
          </h1>
        </div>

        <form
          onSubmit={signIn}
          style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 12, padding: 24 }}
        >
          <label style={lblStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inpStyle}
            placeholder="admin@firma.ro"
          />
          <label style={{ ...lblStyle, marginTop: 14 }}>Parolă</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inpStyle}
          />
          {err && (
            <div style={{ color: "#b3261e", fontSize: 13, marginTop: 12 }}>{err}</div>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%", marginTop: 18, padding: "11px", background: "#16324f",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Se conectează…" : "Intră în cont"}
          </button>
        </form>
        <p style={{ fontSize: 12, color: "#5a6573", textAlign: "center", marginTop: 14 }}>
          Contul de admin se creează din Supabase (Authentication → Users).
        </p>
      </div>
    </div>
  );
}

const lblStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#5a6573",
  textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5,
};
const inpStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", border: "1px solid #dde3ea",
  borderRadius: 8, fontSize: 14,
};
