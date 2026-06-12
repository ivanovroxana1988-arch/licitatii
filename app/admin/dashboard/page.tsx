import { createClient } from "@/lib/supabase-server";
import LogoutButton from "@/components/LogoutButton";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: licitatii, error } = await supabase
    .from("licitatii")
    .select("id, nume, referinta, beneficiar, status, pondere_pret")
    .order("creat_la", { ascending: false });

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "#16324f", color: "#fff", padding: "16px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.7, letterSpacing: ".08em" }}>
            MOTOR DE LICITAȚII
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>Tablou de bord</div>
        </div>
        <LogoutButton />
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Licitații</h2>
        <p style={{ fontSize: 13, color: "#5a6573", marginBottom: 16 }}>
          Conexiune la baza de date confirmată dacă vezi licitația de test mai jos.
        </p>

        {error && (
          <div style={{ color: "#b3261e", fontSize: 14 }}>
            Eroare la citirea datelor: {error.message}
          </div>
        )}

        {licitatii && licitatii.length === 0 && (
          <div style={{ color: "#5a6573", fontSize: 14, padding: 20, background: "#fff", borderRadius: 10, border: "1px solid #dde3ea" }}>
            Nicio licitație încă. Rulează migrația 03_seed.sql ca să apară cea de test.
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {licitatii?.map((l) => (
            <div
              key={l.id}
              style={{
                background: "#fff", border: "1px solid #dde3ea", borderRadius: 10,
                padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{l.nume}</div>
                <div style={{ fontSize: 13, color: "#5a6573", marginTop: 2 }}>
                  {l.referinta} · {l.beneficiar}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                    background: l.status === "activa" ? "#e6f4ec" : "#f1efe8",
                    color: l.status === "activa" ? "#2e7d52" : "#5a6573",
                  }}
                >
                  {l.status}
                </span>
                <div style={{ fontSize: 12, color: "#5a6573", marginTop: 6 }}>
                  preț {l.pondere_pret}% / tehnic {100 - l.pondere_pret}%
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "#888780", marginTop: 24, fontStyle: "italic" }}>
          Aceasta e versiunea Etapa 2 — confirmă autentificarea și conexiunea. În etapele
          următoare adăugăm formularul formatorilor, calculul punctajelor și exportul dosarului.
        </p>
      </main>
    </div>
  );
}
