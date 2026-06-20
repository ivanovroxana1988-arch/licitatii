import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import CompanyAutofillPanel from "@/components/CompanyAutofillPanel";
import FinalDossierUploads from "@/components/FinalDossierUploads";
import { createClient } from "@/lib/supabase-server";
import type { TenderWorkspace } from "@/lib/tender-workspace";

export default async function TenderWorkspacePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [licitatieResult, workspaceResult] = await Promise.all([
    supabase.from("licitatii").select("id,nume,referinta,beneficiar,status,pondere_pret").eq("id", params.id).single(),
    supabase
      .from("licitatie_workspaces")
      .select("source_filename,brief_json,technical_proposal_markdown,created_at,updated_at")
      .eq("licitatie_id", params.id)
      .single(),
  ]);

  const workspace = workspaceResult.data?.brief_json as TenderWorkspace | undefined;

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={headerStyle}>
        <div>
          <div style={kickerLightStyle}>MOTOR DE LICITATII</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>Tender Workspace</div>
        </div>
        <LogoutButton />
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <Link href={`/admin/licitatii/${params.id}`} style={backLinkStyle}>Inapoi la licitatie</Link>
            <h1 style={{ fontSize: 22, color: "#16324f", marginTop: 8 }}>{licitatieResult.data?.nume ?? "Licitatie"}</h1>
            <p style={mutedStyle}>{licitatieResult.data?.referinta} {licitatieResult.data?.beneficiar ? `- ${licitatieResult.data.beneficiar}` : ""}</p>
          </div>
          <div style={actionsStyle}>
            <Link href={`/admin/licitatii/${params.id}/formular`} style={buttonLinkStyle}>Configureaza formular</Link>
            <Link href="/admin/companie" style={buttonLinkStyle}>Profil companie</Link>
            <Link href={`/admin/licitatii/${params.id}`} style={primaryButtonLinkStyle}>Recrutare experti</Link>
          </div>
        </div>

        {(licitatieResult.error || workspaceResult.error || !workspace) && (
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Workspace indisponibil</h2>
            <p style={mutedStyle}>{licitatieResult.error?.message ?? workspaceResult.error?.message ?? "Nu exista workspace generat pentru aceasta licitatie."}</p>
            <Link href="/admin/licitatii/importa" style={primaryButtonLinkStyle}>Importa specificatii</Link>
          </section>
        )}

        {workspace && (
          <div style={{ display: "grid", gap: 16 }}>
            <section style={summaryGridStyle}>
              <SummaryCard label="Tehnic" value={`${workspace.award.technicalWeight}%`} helper={`${workspace.award.methodologyPoints} metodologie + ${workspace.award.expertsPoints} experti`} />
              <SummaryCard label="Financiar" value={`${workspace.award.financialWeight}%`} helper={workspace.award.financialFormula} />
              <SummaryCard label="Buget estimat" value={formatMoney(workspace.identity.estimatedBudgetNoVat)} helper="fara TVA" />
              <SummaryCard label="Termen" value={workspace.identity.submissionDeadline} helper="depunere oferta" />
            </section>

            <CompanyAutofillPanel licitatieId={params.id} />

            <section style={panelStyle}>
              <div style={kickerStyle}>BRIEF LICITATIE</div>
              <h2 style={sectionTitleStyle}>{workspace.identity.title}</h2>
              <div style={tableStyle}>
                <Info label="Beneficiar" value={workspace.identity.beneficiary} />
                <Info label="Procedura" value={workspace.identity.procedureType} />
                <Info label="CPV" value={workspace.identity.cpv} />
                <Info label="Finantare" value={workspace.identity.fundingSource} />
              </div>
            </section>

            <section style={panelStyle}>
              <div style={kickerStyle}>CURSURI SI LIVRABILE</div>
              <div style={cardGridStyle}>
                {workspace.courses.map((course) => (
                  <article key={course.id} style={miniCardStyle}>
                    <h3 style={miniTitleStyle}>{course.title}</h3>
                    <p style={mutedStyle}>{course.sessions} sesiune/sesiuni x {course.daysPerSession} zi/zile, format {course.format}</p>
                    <List items={course.keyTopics} />
                    <div style={{ marginTop: 8 }}>
                      <strong style={smallTitleStyle}>Elemente practice</strong>
                      <List items={course.practicalElements} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <div style={kickerStyle}>RECRUTARE EXPERTI</div>
              <div style={cardGridStyle}>
                {workspace.experts.map((expert) => (
                  <article key={expert.id} style={miniCardStyle}>
                    <h3 style={miniTitleStyle}>{expert.title}</h3>
                    <strong style={smallTitleStyle}>Minim obligatoriu</strong>
                    <List items={expert.minimumRequirements} />
                    <strong style={smallTitleStyle}>Pentru punctaj maxim</strong>
                    <List items={expert.winningRequirements} />
                  </article>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <div style={kickerStyle}>METODOLOGIE SI RISCURI</div>
              <div style={cardGridStyle}>
                <article style={miniCardStyle}>
                  <h3 style={miniTitleStyle}>Flux implementare</h3>
                  <List items={workspace.methodology.implementationFlow} ordered />
                </article>
                <article style={miniCardStyle}>
                  <h3 style={miniTitleStyle}>Asigurarea calitatii</h3>
                  <List items={workspace.methodology.qualityAssurance} />
                </article>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {workspace.methodology.risks.map((risk) => (
                  <div key={risk.risk} style={riskStyle}>
                    <strong>{risk.risk}</strong>
                    <span>{risk.mitigation}</span>
                  </div>
                ))}
              </div>
            </section>

            <FinalDossierUploads
              licitatieId={params.id}
              groups={[
                { category: "administrative", title: "Documente administrative", items: workspace.dossier.administrativeDocuments },
                { category: "experti", title: "Documente experti", items: workspace.dossier.expertDocuments },
                { category: "verificari-finale", title: "Verificari finale / versiuni semnate", items: workspace.dossier.finalChecks },
              ]}
            />

            {workspace.warnings.length > 0 && (
              <section style={warningPanelStyle}>
                <div style={kickerStyle}>ALERTE SI CLARIFICARI</div>
                <List items={workspace.warnings} />
              </section>
            )}

            <section style={panelStyle}>
              <div style={kickerStyle}>DRAFT PROPUNERE TEHNICA</div>
              <pre style={proposalStyle}>{workspaceResult.data?.technical_proposal_markdown}</pre>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div style={panelStyle}><div style={kickerStyle}>{label}</div><div style={scoreStyle}>{value}</div><div style={mutedStyle}>{helper}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div style={infoRowStyle}><strong>{label}</strong><span>{value}</span></div>;
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return <Tag style={listStyle}>{items.map((item) => <li key={item}>{item}</li>)}</Tag>;
}

function formatMoney(value: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(value) + " lei";
}

const headerStyle = { background: "#16324f", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const kickerLightStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.7, letterSpacing: ".08em" };
const kickerStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5a6573", letterSpacing: ".06em", textTransform: "uppercase" as const };
const panelStyle = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const warningPanelStyle = { ...panelStyle, borderColor: "#f0c36d", background: "#fffaf0" };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const cardGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 };
const miniCardStyle = { border: "1px solid #eef2f6", borderRadius: 8, padding: 13, display: "grid", gap: 8 };
const sectionTitleStyle = { fontSize: 17, color: "#16324f", marginTop: 6 };
const miniTitleStyle = { fontSize: 15, color: "#16324f", margin: 0 };
const smallTitleStyle = { fontSize: 12, color: "#394554" };
const mutedStyle = { fontSize: 13, color: "#5a6573", lineHeight: 1.5 };
const scoreStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 700, color: "#16324f", marginTop: 5 };
const listStyle = { display: "grid", gap: 5, paddingLeft: 18, color: "#394554", fontSize: 13, lineHeight: 1.45 };
const tableStyle = { display: "grid", gap: 7, marginTop: 12 };
const infoRowStyle = { display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, fontSize: 13, borderBottom: "1px solid #eef2f6", paddingBottom: 7 };
const riskStyle = { display: "grid", gap: 4, border: "1px solid #eef2f6", borderRadius: 8, padding: 11, fontSize: 13, color: "#394554" };
const proposalStyle = { whiteSpace: "pre-wrap" as const, background: "#f6f8fb", border: "1px solid #dde3ea", borderRadius: 8, padding: 14, marginTop: 12, fontSize: 13, lineHeight: 1.55, color: "#11161d" };
const backLinkStyle = { color: "#2f6f6a", fontSize: 13, fontWeight: 700, textDecoration: "none" };
const actionsStyle = { alignSelf: "start" as const, display: "flex" as const, gap: 8, flexWrap: "wrap" as const, justifyContent: "flex-end" as const };
const buttonLinkStyle = { border: "1px solid #2f6f6a", borderRadius: 8, padding: "9px 12px", background: "#fff", color: "#2f6f6a", fontWeight: 700, fontSize: 13, textDecoration: "none" };
const primaryButtonLinkStyle = { ...buttonLinkStyle, background: "#2f6f6a", color: "#fff" };
