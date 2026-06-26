import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import AdminLicitatieActions from "@/components/AdminLicitatieActions";
import { createClient } from "@/lib/supabase-server";

type AplicareRow = {
  id: string;
  licitatie_id: string;
  status: string;
  selectat: boolean;
  token: string;
  formator?: { nume?: string | null; prenume?: string | null; email?: string | null } | null;
};

export default async function Dashboard() {
  const supabase = createClient();
  const [{ data: licitatii, error }, { data: aplicari, error: aplicariError }] = await Promise.all([
    supabase.from("licitatii").select("id,nume,referinta,beneficiar,status,pondere_pret").order("creat_la", { ascending: false }),
    supabase
      .from("aplicari")
      .select("id,licitatie_id,status,selectat,token,formator:formatori(nume,prenume,email)")
      .order("creat_la", { ascending: false }),
  ]);

  const rows = ((aplicari ?? []) as unknown as AplicareRow[]) ?? [];

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={header}>
        <div>
          <div style={mono}>MOTOR DE LICITATII</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Tablou de bord</div>
        </div>
        <LogoutButton />
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 18, color: "#16324f" }}>Licitatii</h1>
            <p style={muted}>Configureaza formularul, genereaza linkuri de invitatie si urmareste completarea dosarelor.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/companii" style={secondaryLink}>Companii</Link>
            <Link href="/admin/asocieri" style={secondaryLink}>Asocieri</Link>
            <Link href="/admin/companie" style={secondaryLink}>Profil companie vechi</Link>
            <Link href="/admin/experienta-similara" style={secondaryLink}>Experienta similara</Link>
            <Link href="/admin/licitatii/importa" style={primaryLink}>Importa specificatii</Link>
          </div>
        </div>

        {(error || aplicariError) && <div style={{ color: "#b3261e", marginBottom: 14 }}>Eroare: {error?.message ?? aplicariError?.message}</div>}
        {licitatii?.length === 0 && <div style={card}>Nicio licitatie inca.</div>}

        <div style={{ display: "grid", gap: 14 }}>
          {licitatii?.map((l) => {
            const a = rows.filter((r) => r.licitatie_id === l.id);
            return (
              <section key={l.id} style={card}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 16, color: "#16324f" }}>{l.nume}</h2>
                    <p style={muted}>{l.referinta} - {l.beneficiar}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <Stat label="Aplicari" value={a.length} />
                      <Stat label="Finalizate" value={a.filter((x) => x.status === "finalizat").length} />
                      <Stat label="Selectati" value={a.filter((x) => x.selectat).length} />
                    </div>
                  </div>
                  <div style={{ display: "grid", justifyContent: "end", gap: 8 }}>
                    <span style={badge}>{l.status}</span>
                    <div style={{ fontSize: 12, color: "#5a6573", textAlign: "right" }}>
                      pret {l.pondere_pret}% / tehnic {100 - Number(l.pondere_pret)}%
                    </div>
                    <AdminLicitatieActions licitatieId={l.id} />
                  </div>
                </div>
                {a.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: "1px solid #eef2f6", paddingTop: 12 }}>
                    <b style={{ fontSize: 12, color: "#5a6573" }}>Aplicari recente</b>
                    {a.slice(0, 5).map((r) => (
                      <div key={r.id} style={row}>
                        <span>
                          <b>
                            {r.formator?.nume || r.formator?.prenume
                              ? `${r.formator?.prenume ?? ""} ${r.formator?.nume ?? ""}`.trim()
                              : "Formator invitat"}
                          </b>
                          <br />
                          <small>{r.formator?.email ?? `/aplica/${r.token}`}</small>
                        </span>
                        <span style={badge}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #dde3ea", borderRadius: 7, padding: "7px 9px", minWidth: 92 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#5a6573" }}>{label}</div>
    </div>
  );
}

const header = { background: "#16324f", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const mono = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.7, letterSpacing: ".08em" };
const card = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const muted = { fontSize: 13, color: "#5a6573", marginTop: 4 };
const badge = { justifySelf: "end", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#e6f4ec", color: "#2e7d52" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 10px", border: "1px solid #eef2f6", borderRadius: 7, marginTop: 8 };
const primaryLink = { alignSelf: "start", border: "none", borderRadius: 8, padding: "10px 13px", background: "#16324f", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 };
const secondaryLink = { ...primaryLink, border: "1px solid #2f6f6a", background: "#fff", color: "#2f6f6a" };
