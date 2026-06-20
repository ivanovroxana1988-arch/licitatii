create table if not exists public.companie_profil (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  denumire text,
  cui text,
  nr_reg_com text,
  sediu text,
  localitate text,
  judet text,
  iban text,
  banca text,
  reprezentant_nume text,
  reprezentant_functie text,
  email text,
  telefon text,
  website text,
  caen_principal text,
  caen_secundare text,
  descriere text,
  experienta_similara text,
  declaratii_json jsonb not null default '{}'::jsonb,
  documente_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companie_profil_singleton_idx
  on public.companie_profil ((true));

alter table public.companie_profil enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'companie_profil'
      and policyname = 'Admin poate gestiona profil companie'
  ) then
    create policy "Admin poate gestiona profil companie"
      on public.companie_profil
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

create table if not exists public.licitatie_companie_autofill (
  id uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references public.licitatii(id) on delete cascade,
  profil_id uuid references public.companie_profil(id) on delete set null,
  valori_json jsonb not null default '{}'::jsonb,
  lipsuri_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (licitatie_id)
);

create index if not exists licitatie_companie_autofill_licitatie_id_idx
  on public.licitatie_companie_autofill(licitatie_id);

alter table public.licitatie_companie_autofill enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'licitatie_companie_autofill'
      and policyname = 'Admin poate gestiona autofill companie licitatie'
  ) then
    create policy "Admin poate gestiona autofill companie licitatie"
      on public.licitatie_companie_autofill
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_companie_profil_updated_at on public.companie_profil;
create trigger set_companie_profil_updated_at
before update on public.companie_profil
for each row execute function public.set_updated_at();

drop trigger if exists set_licitatie_companie_autofill_updated_at on public.licitatie_companie_autofill;
create trigger set_licitatie_companie_autofill_updated_at
before update on public.licitatie_companie_autofill
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
