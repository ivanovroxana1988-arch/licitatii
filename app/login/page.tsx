"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Mode = "login" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
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

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!email) {
      setErr("Introdu adresa de email.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) {
      setErr("Nu am putut trimite emailul. Încearcă din nou.");
      return;
    }
    setMsg("Dacă există un cont cu acest email, vei primi un link de resetare a parolei.");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5a6573", letterSpacing: ".08em" }}>
            MOTOR DE LICITAȚII
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "#16324f" }}>
            {mode === "login" ? "Autentificare" : "Resetare parolă"}
          </h1>
        </div>

        {mode === "login" ? (
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
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setErr(null);
                setMsg(null);
              }}
              style={linkBtnStyle}
            >
              Am uitat parola
            </button>
          </form>
        ) : (
          <form
            onSubmit={sendReset}
            style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 12, padding: 24 }}
          >
            <p style={{ fontSize: 13, color: "#5a6573", marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
              Introdu adresa de email a contului. Îți vom trimite un link pentru a-ți seta o parolă nouă.
            </p>
            <label style={lblStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inpStyle}
              placeholder="admin@firma.ro"
            />
            {err && (
              <div style={{ color: "#b3261e", fontSize: 13, marginTop: 12 }}>{err}</div>
            )}
            {msg && (
              <div style={{ color: "#1a7f37", fontSize: 13, marginTop: 12 }}>{msg}</div>
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
              {busy ? "Se trimite…" : "Trimite link de resetare"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErr(null);
                setMsg(null);
              }}
              style={linkBtnStyle}
            >
              Înapoi la autentificare
            </button>
          </form>
        )}

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
const linkBtnStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 14, background: "none",
  border: "none", color: "#16324f", fontSize: 13, fontWeight: 600,
  cursor: "pointer", textAlign: "center", textDecoration: "underline",
};
