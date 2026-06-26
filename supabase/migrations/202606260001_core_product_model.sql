-- Core product model for Licitatii AI
-- Safe additive migration for Supabase/Postgres.

create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cui text,
  registration_no text,
  legal_form text,
  address text,
  representative_name text,
  representative_role text,
  email text,
  phone text,
  website text,
  caen_codes text[] default '{}',
  cpv_codes text[] default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null,
  title text not null,
  storage_path text,
  issue_date date,
  expiry_date date,
  signed_status text default 'unknown',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_experience_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  beneficiary text,
  domain text,
  cpv_code text,
  value numeric,
  currency text default 'RON',
  start_date date,
  end_date date,
  description text,
  evidence_document_id uuid references company_documents(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_company_id uuid references companies(id) on delete set null,
  purpose text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists association_members (
  association_id uuid not null references associations(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text,
  responsibility text,
  share_percent numeric check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  is_leader boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (association_id, company_id)
);

create table if not exists trainers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  city text,
  availability_status text default 'unknown',
  rate_day numeric,
  rate_hour numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trainer_skills (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  skill text not null,
  level text,
  years_experience numeric,
  created_at timestamptz not null default now()
);

create table if not exists trainer_documents (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  kind text not null,
  title text not null,
  storage_path text,
  issue_date date,
  expiry_date date,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tender_id intentionally has no FK here because the existing `licitatii` table shape may differ.
-- Once the current schema is confirmed, add a proper foreign key.
create table if not exists tender_company_matches (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid,
  company_id uuid references companies(id) on delete cascade,
  association_id uuid references associations(id) on delete cascade,
  scores jsonb not null default '{}',
  risks jsonb not null default '{}',
  recommendation text,
  generated_at timestamptz not null default now(),
  constraint tender_match_candidate_check check (
    (company_id is not null and association_id is null)
    or (company_id is null and association_id is not null)
  )
);

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid,
  company_id uuid references companies(id) on delete set null,
  association_id uuid references associations(id) on delete set null,
  status text not null default 'draft',
  checklist jsonb not null default '[]',
  risk_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dossier_candidate_check check (
    (company_id is not null and association_id is null)
    or (company_id is null and association_id is not null)
  )
);

create table if not exists dossier_documents (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  kind text not null,
  title text not null,
  storage_path text,
  status text not null default 'draft',
  requires_signature boolean not null default false,
  signed_status text default 'not_required',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_companies_cui on companies(cui);
create index if not exists idx_company_documents_company_id on company_documents(company_id);
create index if not exists idx_company_experience_company_id on company_experience_contracts(company_id);
create index if not exists idx_company_experience_cpv_code on company_experience_contracts(cpv_code);
create index if not exists idx_association_members_company_id on association_members(company_id);
create index if not exists idx_trainer_skills_skill on trainer_skills(skill);
create index if not exists idx_tender_company_matches_tender_id on tender_company_matches(tender_id);
create index if not exists idx_dossiers_tender_id on dossiers(tender_id);
create index if not exists idx_dossier_documents_dossier_id on dossier_documents(dossier_id);
