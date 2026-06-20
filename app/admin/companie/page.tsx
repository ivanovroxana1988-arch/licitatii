import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import CompanyProfileForm from "@/components/CompanyProfileForm";

export default function CompanyProfilePage() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={headerStyle}>
        <div>
          <div style={kickerLightStyle}>MOTOR DE LICITATII</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>Profil companie</div>
        </div>
        <LogoutButton />
      </header>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 44px" }}>
        <Link href="/admin/dashboard" style={backLinkStyle}>Inapoi la dashboard</Link>
        <div style={{ marginTop: 14 }}>
          <CompanyProfileForm />
        </div>
      </main>
    </div>
  );
}

const headerStyle = { background: "#16324f", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const kickerLightStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: 0.7, letterSpacing: ".08em" };
const backLinkStyle = { color: "#2f6f6a", fontSize: 13, fontWeight: 700, textDecoration: "none" };
