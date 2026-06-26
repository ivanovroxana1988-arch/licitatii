import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { createServiceClient } from "@/lib/supabase-server";

type RouteParams = { params: { id: string } };
type Company = { id: string; name: string; cui?: string | null; caen_codes?: string[] | null; cpv_codes?: string[] | null };
type Member = { company_id: string; role?: string | null; responsibility?: string | null; share_percent?: number | null; is_leader?: boolean; company?: Company | null };
type Experience = { company_id: string; value?: number | null; currency?: string | null; title?: string | null; cpv_code?: string | null; domain?: string | null };

const SELECT_FULL = "id,name,leader_company_id,purpose,notes,leader:companies!associations_leader_company_id_fkey(id,name,cui,caen_codes,cpv_codes),members:association_members(company_id,role,responsibility,share_percent,is_leader,company:companies(id,name,cui,caen_codes,cpv_codes))";

export default async function AssociationOverviewPage({ params }: RouteParams) {
  const service = createServiceClient();
  const { data: association, error } = await service.from("associations").select(SELECT_FULL).eq("id", params.id).maybeSingle();

  if (error) return <Shell title="Eroare"><Panel><p style={errorStyle}>{error.message}</p></Panel></Shell>;
  if (!association) return <Shell title="Asociere negasita"><Panel><p style={errorStyle}>Asocierea nu a fost gasita.</p></Panel></Shell>;

  const members = ((association.members ?? []) as Member[]).filter((member) => member.company_id);
  const companyIds = members.map((member) => member.company_id);
  const { data: experiences } = companyIds.length
    ? await service.from("company_experience_contracts").select("company_id,title,value,currency,cpv_code,domain").in("company_id", companyIds)
    : { data: [] as Experience[] };

  const overview = buildOverview(association as Record<string, unknown>, members, (experiences ?? []) as Experience[]);

  return (
    <Shell title="Overview asociere">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Link href="/admin/asocieri" style={backLinkStyle}>Inapoi la asocieri</Link>
        <Link href="/admin/companii" style={secondaryLinkStyle}>Companii</Link>
      </div>

      <section style={panelStyle}>
        <div style={kickerStyle}>OVERVIEW ASOCIERE</div>
        <h1 style={titleStyle}>{String(overview.name ?? "Asociere")}</h1>
        <p style={mutedStyle}>{String(overview.purpose ?? "Fara scop completat")}</p>
        <div style={statsGridStyle}>
          <Stat label="Membri" value={overview.member_count} />
          <Stat label="Ponderi" value={`${overview.total_share}%`} />
          <Stat label="CAEN" value={overview.caen_codes.length} />
          <Stat label="CPV" value={overview.cpv_codes.length} />
          <Stat label="Experiente" value={overview.experience_count} />
          <Stat label="Valoare exp." value={`${overview.experience_total_value.toLocaleString("ro-RO")} RON`} />
        </div>
      </section>

      <div style={twoColStyle}>
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Puncte acoperite</h2>
          <List items={overview.strengths} empty="Inca nu exista puncte tari evidente." type="ok" />
        </section>
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Riscuri / lipsuri</h2>
          <List items={overview.risks} empty="Nu exista riscuri evidente in overview-ul de baza." type="risk" />
        </section>
      </div>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Membri asociere</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {overview.members.map((member) => (
            <article key={member.company_id} style={memberCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ color: "#16324f" }}>{member.company_name}</strong>
                  <div style={mutedStyle}>{member.cui ?? "CUI lipsa"}</div>
                </div>
                {member.is_leader && <span style={badgeStyle}>Lider</span>}
              </div>
              <div style={statsGridStyle}>
                <Stat label="Rol" value={member.role ?? "-"} />
                <Stat label="Pondere" value={member.share_percent ? `${member.share_percent}%` : "-"} />
                <Stat label="Experiente" value={member.experience_count} />
                <Stat label="Valoare exp." value={`${member.experience_total_value.toLocaleString("ro-RO")} RON`} />
              </div>
              <p style={mutedStyle}><strong>Responsabilitate:</strong> {member.responsibility ?? "necompletata"}</p>
              <TagBlock title="CAEN" values={member.caen_codes} />
              <TagBlock title="CPV" values={member.cpv_codes} />
            </article>
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Coduri agregate</h2>
        <TagBlock title="CAEN agregat" values={overview.caen_codes} />
        <TagBlock title="CPV agregat" values={overview.cpv_codes} />
      </section>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={headerStyle}>
        <div>
          <div style={kickerLightStyle}>MOTOR DE LICITATII</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{title}</div>
        </div>
        <LogoutButton />
      </header>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 44px", display: "grid", gap: 16 }}>{children}</main>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section style={panelStyle}>{children}</section>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={statStyle}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#16324f" }}>{value}</div>
      <div style={mutedStyle}>{label}</div>
    </div>
  );
}

function List({ items, empty, type }: { items: string[]; empty: string; type: "ok" | "risk" }) {
  if (!items.length) return <div style={emptyStyle}>{empty}</div>;
  return <div style={{ display: "grid", gap: 8 }}>{items.map((item) => <div key={item} style={type === "ok" ? okItemStyle : riskItemStyle}>{item}</div>)}</div>;
}

function TagBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={labelStyle}>{title}</div>
      <div style={tagRowStyle}>{values.length ? values.map((value) => <span key={value} style={tagStyle}>{value}</span>) : <span style={mutedStyle}>nimic salvat</span>}</div>
    </div>
  );
}

function buildOverview(association: Record<string, unknown>, members: Member[], experiences: Experience[]) {
  const caenCodes = unique(members.flatMap((member) => member.company?.caen_codes ?? []));
  const cpvCodes = unique(members.flatMap((member) => member.company?.cpv_codes ?? []));
  const totalShare = members.reduce((sum, member) => sum + (Number(member.share_percent) || 0), 0);
  const experiencesByCompany = groupExperiencesByCompany(experiences);
  const risks: string[] = [];
  const strengths: string[] = [];

  if (!association.leader_company_id) risks.push("Liderul asocierii nu este setat.");
  if (members.length < 2) risks.push("Asocierea are mai putin de doua companii.");
  if (totalShare > 0 && Math.abs(totalShare - 100) > 0.01) risks.push(`Ponderile insumeaza ${totalShare}%, nu 100%.`);
  if (!caenCodes.length) risks.push("Nu exista coduri CAEN salvate pe membrii asocierii.");
  if (!cpvCodes.length) risks.push("Nu exista coduri CPV salvate pe membrii asocierii.");
  if (!experiences.length) risks.push("Nu exista experienta similara salvata pentru membrii asocierii.");
  if (members.some((member) => !member.responsibility)) risks.push("Cel putin un membru nu are responsabilitate completata.");

  if (association.leader_company_id) strengths.push("Liderul asocierii este setat.");
  if (members.length >= 2) strengths.push("Asocierea are cel putin doi membri.");
  if (caenCodes.length) strengths.push(`${caenCodes.length} coduri CAEN agregate.`);
  if (cpvCodes.length) strengths.push(`${cpvCodes.length} coduri CPV agregate.`);
  if (experiences.length) strengths.push(`${experiences.length} contracte de experienta similara disponibile.`);

  return {
    name: association.name,
    purpose: association.purpose,
    member_count: members.length,
    total_share: totalShare,
    caen_codes: caenCodes,
    cpv_codes: cpvCodes,
    experience_count: experiences.length,
    experience_total_value: experiences.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
    strengths,
    risks,
    members: members.map((member) => {
      const companyExperiences = experiencesByCompany.get(member.company_id) ?? [];
      return {
        company_id: member.company_id,
        company_name: member.company?.name ?? member.company_id,
        cui: member.company?.cui ?? null,
        role: member.role ?? null,
        responsibility: member.responsibility ?? null,
        share_percent: Number(member.share_percent) || null,
        is_leader: Boolean(member.is_leader) || member.company_id === association.leader_company_id,
        caen_codes: member.company?.caen_codes ?? [],
        cpv_codes: member.company?.cpv_codes ?? [],
        experience_count: companyExperiences.length,
        experience_total_value: companyExperiences.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
      };
    }),
  };
}

function unique(values: string[]) { return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort(); }
function groupExperiencesByCompany(experiences: Experience[]) {
  const map = new Map<string, Experience[]>();
  for (const experience of experiences) {
    if (!experience.company_id) continue;
    const current = map.get(experience.company_id) ?? [];
    current.push(experience);
    map.set(experience.company_id, current);
  }
  return map;
}

const headerStyle = { background: "#16324f", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const kickerLightStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.7, letterSpacing: ".08em" };
const backLinkStyle = { color: "#2f6f6a", fontSize: 13, fontWeight: 700, textDecoration: "none" };
const secondaryLinkStyle = { ...backLinkStyle, color: "#5a6573" };
const panelStyle = { background: "#fff", border: "1px solid #dde3ea", borderRadius: 8, padding: 16 };
const kickerStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#2f6f6a", fontWeight: 700, letterSpacing: ".08em" };
const titleStyle = { fontSize: 20, color: "#16324f", margin: "6px 0 4px" };
const sectionTitleStyle = { fontSize: 16, color: "#16324f", margin: "0 0 10px" };
const mutedStyle = { fontSize: 13, color: "#5a6573", marginTop: 4 };
const statsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginTop: 14 };
const statStyle = { border: "1px solid #eef2f6", borderRadius: 8, padding: 10 };
const twoColStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 };
const okItemStyle = { border: "1px solid #b7dfc8", background: "#f1fbf5", color: "#2e7d52", borderRadius: 8, padding: 10, fontSize: 13 };
const riskItemStyle = { border: "1px solid #f3d19c", background: "#fff8ec", color: "#8a5a00", borderRadius: 8, padding: 10, fontSize: 13 };
const emptyStyle = { border: "1px dashed #cfd7df", borderRadius: 8, padding: 12, color: "#5a6573", fontSize: 13 };
const memberCardStyle = { border: "1px solid #dde3ea", borderRadius: 8, padding: 12 };
const badgeStyle = { fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: "#e6f4ec", color: "#2e7d52", alignSelf: "start" };
const labelStyle = { fontSize: 12, fontWeight: 700, color: "#16324f" };
const tagRowStyle = { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 };
const tagStyle = { borderRadius: 999, background: "#eef6f5", color: "#2f6f6a", padding: "3px 8px", fontSize: 11, fontWeight: 700 };
const errorStyle = { border: "1px solid #f3b1aa", background: "#fff4f2", color: "#b3261e", borderRadius: 8, padding: 10, fontSize: 13 };
