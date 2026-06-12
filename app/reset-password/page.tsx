"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // La accesarea linkului din email, Supabase stabilește o sesiune temporară
    // de recuperare. Verificăm dacă există înainte de a permite schimbarea parolei.
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setValidSession(true);
      }
      setReady(true);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setValidSession(true);
        setReady(true);
      }
    });

    check();
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (password.length < 6) {
      setErr("Parola trebuie să aibă cel puțin 6 caractere.");
      return;
    }
    if (password !== confirm) {
      setErr("Parolele nu coincid.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErr("Nu am putut actualiza parola. Linkul poate fi expirat.");
      return;
    }
    setMsg("Parola a fost schimbată cu succes. Te redirecționăm…");
    setTimeout(() => {
      router.push("/admin/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5a6573", letterSpacing: ".08em" }}>
            MOTOR DE LICITAȚII
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "#16324f" }}>
            Setează parola nouă
          </h1>
        </div>

        <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 12, padding: 24 }}>
          {!ready ? (
            <p style={{ fontSize: 13, color: "#5a6573", margin: 0 }}>Se verifică linkul…</p>
          ) : !validSession ? (
            <div>
              <p style={{ fontSize: 13, color: "#b3261e", margin: 0, lineHeight: 1.5 }}>
                Link invalid sau expirat. Solicită un nou link de resetare din pagina de autentificare.
              </p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                style={{
                  width: "100%", marginTop: 18, padding: "11px", background: "#16324f",
                  color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
                }}
              >
                Mergi la autentificare
              </button>
            </div>
          ) : (
            <form onSubmit={updatePassword}>
              <label style={lblStyle}>Parolă nouă</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inpStyle}
                placeholder="Minim 6 caractere"
              />
              <label style={{ ...lblStyle, marginTop: 14 }}>Confirmă parola</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                style={inpStyle}
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
                {busy ? "Se salvează…" : "Salvează parola"}
              </button>
            </form>
          )}
        </div>
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
