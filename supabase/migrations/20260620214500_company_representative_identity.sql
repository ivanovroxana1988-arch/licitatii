alter table public.companie_profil
  add column if not exists reprezentant_ci_serie text,
  add column if not exists reprezentant_ci_numar text,
  add column if not exists reprezentant_ci_eliberat_de text,
  add column if not exists reprezentant_ci_data text,
  add column if not exists reprezentant_ci_valabil_pana text,
  add column if not exists reprezentant_validat_constatator boolean not null default false,
  add column if not exists reprezentant_validare_detalii text;

notify pgrst, 'reload schema';
