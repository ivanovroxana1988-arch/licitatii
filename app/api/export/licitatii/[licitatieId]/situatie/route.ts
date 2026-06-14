import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  buildSituationCsv,
  buildSituationFilename,
  type SituationAplicare,
  type SituationContract,
  type SituationLicitatie,
} from "@/lib/export-situation";
import { createServiceClient } from "@/lib/supabase-server";
import type { Criteriu, Factor } from "@/lib/scoring";

export const runtime = "nodejs";

type RouteContext = { params: { licitatieId: string } };

type AplicareRow = Omit<SituationAplicare, "contracte"> & {
  formator_id: string | null;
};

type ContractRow = SituationContract & {
  formator_id: string;
  ordine?: number | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const supabase = createServiceClient();
    const [licitatieResult, factoriResult, criteriiResult, aplicariResult] = await Promise.all([
      supabase
        .from("licitatii")
        .select("id, nume, referinta, beneficiar")
        .eq("id", params.licitatieId)
        .single(),
      supabase
        .from("factori")
        .select("id, cod, denumire, punctaj_max, tip, agregare, config_json")
        .eq("licitatie_id", params.licitatieId)
        .order("ordine", { ascending: true }),
      supabase
        .from("criterii_eligibilitate")
        .select("id, eticheta, tip, factor_cod, valoare_min")
        .eq("licitatie_id", params.licitatieId)
        .order("ordine", { ascending: true }),
      supabase
        .from("aplicari")
        .select(
          "id, status, selectat, token, formator_id, raspunsuri_formular_json, formator:formatori(id, nume, prenume, email, telefon, domeniu_studii, studii_detalii, are_cor_242401, ani_management, bio)"
        )
        .eq("licitatie_id", params.licitatieId)
        .order("creat_la", { ascending: false }),
    ]);

    const error =
      licitatieResult.error?.message ??
      factoriResult.error?.message ??
      criteriiResult.error?.message ??
      aplicariResult.error?.message;
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    const aplicari = ((aplicariResult.data ?? []) as unknown as AplicareRow[]) ?? [];
    const formatorIds = aplicari
      .map((row) => row.formator_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const contracteResult = formatorIds.length
      ? await supabase
          .from("contracte")
          .select(
            "formator_id, organizatie, domeniu_org, structura_complexa, perioada, ore, tematici, nr_tematici, ordine"
          )
          .in("formator_id", formatorIds)
          .order("ordine", { ascending: true })
      : { data: [], error: null };
    if (contracteResult.error) throw contracteResult.error;

    const contractsByFormator = new Map<string, SituationContract[]>();
    for (const contract of ((contracteResult.data ?? []) as unknown as ContractRow[]) ?? []) {
      const current = contractsByFormator.get(contract.formator_id) ?? [];
      current.push(contract);
      contractsByFormator.set(contract.formator_id, current);
    }

    const reportAplicari: SituationAplicare[] = aplicari.map((row) => ({
      id: row.id,
      status: row.status,
      selectat: !!row.selectat,
      token: row.token,
      raspunsuri_formular_json: row.raspunsuri_formular_json ?? {},
      formator: row.formator,
      contracte: row.formator_id ? contractsByFormator.get(row.formator_id) ?? [] : [],
    }));

    const licitatie = licitatieResult.data as SituationLicitatie;
    const csv = buildSituationCsv({
      licitatie,
      aplicari: reportAplicari,
      factori: ((factoriResult.data ?? []) as unknown as Factor[]) ?? [],
      criterii: ((criteriiResult.data ?? []) as unknown as Criteriu[]) ?? [],
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildSituationFilename(licitatie)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscuta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
