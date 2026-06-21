alter table public.companie_profil
  add column if not exists caen_autorizate_la_sediu text,
  add column if not exists caen_autorizate_la_terti text,
  add column if not exists caen_relevante_licitatie text,
  add column if not exists caen_sursa_validare text;

notify pgrst, 'reload schema';
