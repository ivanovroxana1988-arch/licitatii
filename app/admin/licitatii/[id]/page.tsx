import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import LicitatieAdminPanel, { type AdminAplicare } from "@/components/LicitatieAdminPanel";
import { createClient } from "@/lib/supabase-server";
import type { Criteriu, Factor } from "@/lib/scoring";

type PageProps = { params: { id: string } };

type AplicareRow = {
  id: string;
  status: string;
  selectat: boolean;
  token: string;
  formator_id: string | null;
  raspunsuri_formular_json?: Record<string, unknown> | null;
  formator?: {
    id: string;
    nume?: string | null;
    prenume?: string | null;
    email?: string | null;
    domeniu_studii?: string | null;
    are_cor_242401?: boolean | null;
  } | null;
};

type ContractRow = {
  formator_id: string;
  organizatie: string;
  structura_complexa: boolean;
  ore: number;
  nr_tematici: number;
  ordine?: number | null;
};

export default async function LicitatiePage({ params }: PageProps) {
  const supabase = createClient();
  const [licitatieResult, factoriResult, criteriiResult, aplicariResult] = await Promise.all([
    supabase
      .from("licitatii")
      .select("id, nume, referinta, beneficiar, pondere_pret, status")
      .eq("id", params.id)
      .single(),
    supabase
      .from("factori")
      .select("id, cod, denumire, punctaj_max, tip, agregare, config_json")
      .eq("licitatie_id", params.id)
      .order("ordine", { ascending: true }),
    supabase
      .from("criterii_eligibilitate")
      .select("id, eticheta, tip, factor_cod, valoare_min")
      .eq("licitatie_id", params.id)
      .order("ordine", { ascending: true }),
    supabase
      .from("aplicari")
      .select(
        "id, status, selectat, token, formator_id, raspunsuri_formular_json, formator:formatori(id, nume, prenume, email, domeniu_studii, are_cor_242401)"
      )
      .eq("licitatie_id", params.id)
      .order("creat_la", { ascending: false }),
  ]);

  const error =
    licitatieResult.error?.message ??
    factoriResult.error?.message ??
    criteriiResult.error?.message ??
    aplicariResult.error?.message;

  const aplicari = ((aplicariResult.data ?? []) as unknown as AplicareRow[]) ?? [];
  const formatorIds = aplicari
    .map((row) => row.formator_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const contracteResult = formatorIds.length
    ? await supabase
        .from("contracte")
        .select("formator_id, organizatie, structura_complexa, ore, nr_tematici, ordine")
        .in("formator_id", formatorIds)
        .order("ordine", { ascending: true })
    : { data: [], error: null };

  const contractsByFormator = new Map<string, ContractRow[]>();
  for (const contract of ((contracteResult.data ?? []) as unknown as ContractRow[]) ?? []) {
    const current = contractsByFormator.get(contract.formator_id) ?? [];
    current.push(contract);
    contractsByFormator.set(contract.formator_id, current);
  }

  const panelAplicari: AdminAplicare[] = aplicari.map((row) => ({
    id: row.id,
    status: row.status,
    selectat: !!row.selectat,
    token: row.token,
    formator: row.formator
      ? {
          ...row.formator,
          raspunsuri_formular_json: row.raspunsuri_formular_json ?? {},
        }
      : null,
    contracte: row.formator_id
      ? (contractsByFormator.get(row.formator_id) ?? []).map((contract) => ({
          organizatie: contract.organizatie,
          structura_complexa: !!contract.structura_complexa,
          ore: Number(contract.ore ?? 0),
          nr_tematici: Number(contract.nr_tematici ?? 0),
        }))
      : [],
  }));

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={headerStyle}>
        <div>
          <div style={kickerStyle}>MOTOR DE LICITATII</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>Detaliu licitatie</div>
        </div>
        <LogoutButton />
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <Link href="/admin/dashboard" style={backLinkStyle}>Inapoi la dashboard</Link>
            <h1 style={{ fontSize: 22, color: "#16324f", marginTop: 8 }}>{licitatieResult.data?.nume ?? "Licitatie"}</h1>
            <p style={{ fontSize: 13, color: "#5a6573", marginTop: 4 }}>
              {licitatieResult.data?.referinta} {licitatieResult.data?.beneficiar ? `- ${licitatieResult.data.beneficiar}` : ""}
            </p>
          </div>
          <Link href={`/admin/licitatii/${params.id}/formular`} style={buttonLinkStyle}>
            Configureaza formular
          </Link>
        </div>

        {(error || contracteResult.error) && (
          <div style={errorStyle}>Eroare la citirea datelor: {error ?? contracteResult.error?.message}</div>
        )}

        {licitatieResult.data && (
          <LicitatieAdminPanel
            licitatie={licitatieResult.data}
            factori={((factoriResult.data ?? []) as unknown as Factor[]) ?? []}
            criterii={((criteriiResult.data ?? []) as unknown as Criteriu[]) ?? []}
            aplicari={panelAplicari}
          />
        )}
      </main>
    </div>
  );
}

const headerStyle = {
  background: "#16324f",
  color: "#fff",
  padding: "16px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const kickerStyle = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  opacity: 0.7,
  letterSpacing: ".08em",
};

const backLinkStyle = {
  color: "#2f6f6a",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
};

const buttonLinkStyle = {
  alignSelf: "start",
  border: "1px solid #2f6f6a",
  borderRadius: 8,
  padding: "9px 12px",
  background: "#fff",
  color: "#2f6f6a",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
};

const errorStyle = {
  border: "1px solid #f1b5ae",
  borderRadius: 8,
  padding: 12,
  background: "#fff7f6",
  color: "#b3261e",
  fontSize: 13,
  marginBottom: 14,
};
