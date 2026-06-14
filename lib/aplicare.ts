import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFormularConfig, type AplicareContract, type AplicareDocument, type AplicareFormator, type DynamicAnswers } from "@/lib/form-schema";
import type { Criteriu, Factor } from "@/lib/scoring";

export type AplicarePayload = {
  aplicare: { id: string; licitatie_id: string; formator_id: string | null; token: string; status: "invitat" | "in_completare" | "finalizat"; selectat: boolean; readonly: boolean; raspunsuri_formular_json: DynamicAnswers; finalizat_la?: string | null };
  licitatie: { id: string; nume: string; referinta?: string | null; beneficiar?: string | null; formular_config_json: ReturnType<typeof normalizeFormularConfig> };
  formator: AplicareFormator;
  contracte: AplicareContract[];
  documente: AplicareDocument[];
  factori: Factor[];
  criterii: Criteriu[];
};

export async function loadAplicarePayload(supabase: SupabaseClient, token: string): Promise<AplicarePayload | null> {
  const { data, error } = await supabase.from("aplicari").select(`id, licitatie_id, formator_id, token, status, selectat, raspunsuri_formular_json, finalizat_la, licitatie:licitatii(id,nume,referinta,beneficiar,formular_config_json), formator:formatori(id,nume,prenume,email,telefon,domeniu_studii,studii_detalii,are_cor_242401,ani_management,bio)`).eq("token", token).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  const formatorId = row.formator_id as string | null;
  const [contracte, documente, factori, criterii] = await Promise.all([
    formatorId ? supabase.from("contracte").select("id,organizatie,domeniu_org,structura_complexa,perioada,ore,tematici,nr_tematici,ordine").eq("formator_id", formatorId).order("ordine") : Promise.resolve({ data: [], error: null }),
    formatorId ? supabase.from("documente").select("id,formator_id,contract_id,tip,nume_fisier,storage_path,marime,incarcat_la").eq("formator_id", formatorId).order("incarcat_la", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    supabase.from("factori").select("id,cod,denumire,punctaj_max,tip,agregare,config_json").eq("licitatie_id", row.licitatie_id).order("ordine"),
    supabase.from("criterii_eligibilitate").select("id,eticheta,tip,factor_cod,valoare_min").eq("licitatie_id", row.licitatie_id).order("ordine"),
  ]);
  for (const result of [contracte, documente, factori, criterii]) if (result.error) throw result.error;
  const f = row.formator ?? {};
  const l = row.licitatie;
  return {
    aplicare: { id: row.id, licitatie_id: row.licitatie_id, formator_id: row.formator_id, token: row.token, status: row.status, selectat: !!row.selectat, readonly: row.status === "finalizat", raspunsuri_formular_json: objectOrEmpty(row.raspunsuri_formular_json), finalizat_la: row.finalizat_la },
    licitatie: { id: l.id, nume: l.nume, referinta: l.referinta, beneficiar: l.beneficiar, formular_config_json: normalizeFormularConfig(l.formular_config_json) },
    formator: { id: f.id, nume: f.nume ?? "", prenume: f.prenume ?? "", email: f.email ?? "", telefon: f.telefon ?? "", domeniu_studii: f.domeniu_studii ?? "", studii_detalii: f.studii_detalii ?? "", are_cor_242401: !!f.are_cor_242401, ani_management: Number(f.ani_management ?? 0), bio: f.bio ?? "" },
    contracte: (contracte.data ?? []) as AplicareContract[], documente: (documente.data ?? []) as AplicareDocument[], factori: (factori.data ?? []) as Factor[], criterii: (criterii.data ?? []) as Criteriu[],
  };
}

export function objectOrEmpty(value: unknown): DynamicAnswers { return value && typeof value === "object" && !Array.isArray(value) ? value as DynamicAnswers : {}; }
