-- ============================================================
--  MOTOR DE LICITAȚII — Schema bazei de date (Etapa 1)
--  Postgres / Supabase
--  Rulează acest fișier în Supabase: SQL Editor → New query → paste → Run
-- ============================================================

-- Extensii utile
create extension if not exists "pgcrypto";   -- pentru gen_random_uuid()

-- ============================================================
--  1. LICITAȚII
--  O licitație = o procedură de achiziție cu factorii ei.
-- ============================================================
create table if not exists licitatii (
  id            uuid primary key default gen_random_uuid(),
  nume          text not null,
  referinta     text,                         -- ex. "CR 46167"
  beneficiar    text,                          -- ex. "NUCLEARELECTRICA"
  pondere_pret  numeric not null default 60,   -- puncte alocate prețului
  data_limita   date,
  status        text not null default 'activa',-- activa | inchisa | draft
  creat_la      timestamptz not null default now()
);

-- ============================================================
--  2. FACTORI DE EVALUARE  (configurabili din aplicație)
--  Fiecare licitație are factorii ei tehnici.
--  config_json ține pragurile / maparea (flexibil, ca în prototip).
-- ============================================================
create table if not exists factori (
  id           uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references licitatii(id) on delete cascade,
  cod          text not null,                  -- ex. "F2.1"
  denumire     text not null,                  -- ex. "Formare academică"
  punctaj_max  numeric not null default 10,
  tip          text not null,                  -- threshold_value | threshold_count | domain_map
  agregare     text not null default 'max',    -- max | avg | sum
  config_json  jsonb not null default '{}',    -- { tiers:[...] } sau { map:[...] }
  ordine       int not null default 0,
  ajutor       text
);
create index if not exists idx_factori_licitatie on factori(licitatie_id);

-- ============================================================
--  3. CRITERII DE ELIGIBILITATE  (praguri minime, configurabile)
-- ============================================================
create table if not exists criterii_eligibilitate (
  id           uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references licitatii(id) on delete cascade,
  eticheta     text not null,                  -- ex. "Min. 1000 ore"
  tip          text not null,                  -- bool | min_factor
  factor_cod   text,                            -- referință la factori.cod (când tip=min_factor)
  valoare_min  numeric,                         -- pragul minim
  ordine       int not null default 0
);
create index if not exists idx_crit_licitatie on criterii_eligibilitate(licitatie_id);

-- ============================================================
--  4. FORMATORI  (profil reutilizabil, independent de licitație)
-- ============================================================
create table if not exists formatori (
  id              uuid primary key default gen_random_uuid(),
  nume            text,
  prenume         text,
  email           text,
  telefon         text,
  domeniu_studii  text,                          -- cheia din maparea F2.1
  studii_detalii  text,                          -- text liber pt. CV
  are_cor_242401  boolean default false,
  ani_management  numeric default 0,
  bio             text,                          -- scurtă descriere pt. CV
  creat_la        timestamptz not null default now()
);

-- ============================================================
--  5. CONTRACTE  (experiența formatorului, un rând per contract)
-- ============================================================
create table if not exists contracte (
  id                uuid primary key default gen_random_uuid(),
  formator_id       uuid not null references formatori(id) on delete cascade,
  organizatie       text not null,
  domeniu_org       text,                        -- ex. "petrol și gaze"
  structura_complexa boolean default false,      -- califică pt. F2.2
  perioada          text,                         -- ex. "2022-2023"
  ore               numeric default 0,
  tematici          text,                         -- listă separată prin virgulă
  nr_tematici       int default 0,                -- calculat din tematici
  ordine            int not null default 0
);
create index if not exists idx_contracte_formator on contracte(formator_id);

-- ============================================================
--  6. DOCUMENTE  (fișiere încărcate: recomandări, contracte, diplome)
--  Fișierul fizic stă în Supabase Storage; aici ținem doar metadatele.
-- ============================================================
create table if not exists documente (
  id           uuid primary key default gen_random_uuid(),
  formator_id  uuid not null references formatori(id) on delete cascade,
  contract_id  uuid references contracte(id) on delete set null,  -- opțional, dacă e atașat unui contract
  tip          text not null,                  -- recomandare | contract | diploma | certificat | altul
  nume_fisier  text not null,
  storage_path text not null,                  -- calea în bucket
  marime       bigint,
  incarcat_la  timestamptz not null default now()
);
create index if not exists idx_documente_formator on documente(formator_id);

-- ============================================================
--  7. APLICĂRI  (legătura formator ↔ licitație + token de acces)
--  Un formator poate aplica la mai multe licitații.
--  Tokenul unic dă accesul fără parolă la formular.
-- ============================================================
create table if not exists aplicari (
  id            uuid primary key default gen_random_uuid(),
  licitatie_id  uuid not null references licitatii(id) on delete cascade,
  formator_id   uuid references formatori(id) on delete set null,  -- null până completează formatorul
  token         text not null unique default encode(gen_random_bytes(16), 'hex'),
  status        text not null default 'invitat', -- invitat | in_completare | finalizat
  selectat      boolean default false,           -- admin decide cine rămâne în licitație
  punctaj_cache numeric,                          -- ultimul punctaj calculat (opțional)
  eligibil_cache boolean,                         -- ultima eligibilitate (opțional)
  creat_la      timestamptz not null default now(),
  finalizat_la  timestamptz,
  unique (licitatie_id, formator_id)
);
create index if not exists idx_aplicari_licitatie on aplicari(licitatie_id);
create index if not exists idx_aplicari_token on aplicari(token);

-- ============================================================
--  TRIGGER: calculează automat nr_tematici din câmpul "tematici"
-- ============================================================
create or replace function calc_nr_tematici()
returns trigger language plpgsql as $$
begin
  if new.tematici is null or btrim(new.tematici) = '' then
    new.nr_tematici := 0;
  else
    new.nr_tematici := array_length(
      string_to_array(btrim(new.tematici), ','), 1
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_calc_tematici on contracte;
create trigger trg_calc_tematici
  before insert or update on contracte
  for each row execute function calc_nr_tematici();
