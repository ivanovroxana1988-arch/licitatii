create table if not exists public.licitatie_workspaces (
  id uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references public.licitatii(id) on delete cascade,
  source_filename text,
  source_text text,
  brief_json jsonb not null default '{}'::jsonb,
  technical_proposal_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (licitatie_id)
);

create index if not exists licitatie_workspaces_licitatie_id_idx
  on public.licitatie_workspaces(licitatie_id);

alter table public.licitatie_workspaces enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'licitatie_workspaces'
      and policyname = 'Admin poate gestiona workspace licitatii'
  ) then
    create policy "Admin poate gestiona workspace licitatii"
      on public.licitatie_workspaces
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

drop trigger if exists set_licitatie_workspaces_updated_at on public.licitatie_workspaces;
create trigger set_licitatie_workspaces_updated_at
before update on public.licitatie_workspaces
for each row execute function public.set_updated_at();
