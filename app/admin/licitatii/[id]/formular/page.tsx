import Link from "next/link";
import FormConfigEditor from "@/components/FormConfigEditor";
import { normalizeFormularConfig } from "@/lib/form-schema";
import { createClient } from "@/lib/supabase-server";
import type { Factor } from "@/lib/scoring";

export default async function FormularAdminPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [licitatieResult, factoriResult] = await Promise.all([
    supabase.from("licitatii").select("id,nume,referinta,beneficiar,formular_config_json").eq("id", params.id).single(),
    supabase.from("factori").select("id,cod,denumire,punctaj_max,tip,agregare,config_json").eq("licitatie_id", params.id).order("ordine"),
  ]);
  if (licitatieResult.error) return <main style={{ padding: 24 }}><h1>Licitatia nu a fost gasita</h1><p>{licitatieResult.error.message}</p><Link href="/admin/dashboard">Inapoi</Link></main>;
  const licitatie = licitatieResult.data;
  const factori = ((factoriResult.data ?? []) as unknown as Factor[]) ?? [];
  return <div style={{ minHeight: "100vh" }}>
    <header style={{ background: "#16324f", color: "#fff", padding: "16px 20px" }}><div style={{ maxWidth: 1180, margin: "0 auto" }}><Link href="/admin/dashboard" style={{ color: "rgba(255,255,255,.82)", fontSize: 13 }}>Inapoi la dashboard</Link><h1 style={{ fontSize: 20, marginTop: 8 }}>Configurare formular</h1><p style={{ fontSize: 13, opacity: .82 }}>{licitatie.nume} {licitatie.referinta ? `- ${licitatie.referinta}` : ""}</p></div></header>
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 16px 44px" }}><FormConfigEditor licitatieId={licitatie.id} initialConfig={normalizeFormularConfig(licitatie.formular_config_json)} factori={factori} /></main>
  </div>;
}
