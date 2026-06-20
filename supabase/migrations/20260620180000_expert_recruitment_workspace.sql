create table if not exists public.licitatie_expert_candidati (
  id uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references public.licitatii(id) on delete cascade,
  nume text not null,
  email text,
  telefon text,
  rol_tinta text,
  status text not null default 'nou',
  scor_total numeric not null default 0,
  recomandare text,
  analiza_json jsonb not null default '{}'::jsonb,
  creat_la timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists licitatie_expert_candidati_licitatie_id_idx
  on public.licitatie_expert_candidati(licitatie_id);

create table if not exists public.licitatie_expert_documente (
  id uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references public.licitatii(id) on delete cascade,
  candidat_id uuid not null references public.licitatie_expert_candidati(id) on delete cascade,
  tip text not null,
  storage_bucket text not null default 'licitatie-experti',
  storage_path text not null,
  nume_fisier text not null,
  mime_type text not null default 'application/pdf',
  marime_bytes bigint,
  text_extras text,
  incarcat_la timestamptz not null default now()
);

create index if not exists licitatie_expert_documente_candidat_id_idx
  on public.licitatie_expert_documente(candidat_id);

create table if not exists public.licitatie_expert_alocari (
  id uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references public.licitatii(id) on delete cascade,
  role_id text not null,
  role_title text not null,
  candidat_id uuid references public.licitatie_expert_candidati(id) on delete set null,
  status text not null default 'draft',
  validated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (licitatie_id, role_id)
);

create index if not exists licitatie_expert_alocari_licitatie_id_idx
  on public.licitatie_expert_alocari(licitatie_id);

alter table public.licitatie_expert_candidati enable row level security;
alter table public.licitatie_expert_documente enable row level security;
alter table public.licitatie_expert_alocari enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'licitatie_expert_candidati'
      and policyname = 'Admin poate gestiona candidati experti'
  ) then
    create policy "Admin poate gestiona candidati experti"
      on public.licitatie_expert_candidati
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'licitatie_expert_documente'
      and policyname = 'Admin poate gestiona documente experti'
  ) then
    create policy "Admin poate gestiona documente experti"
      on public.licitatie_expert_documente
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'licitatie_expert_alocari'
      and policyname = 'Admin poate gestiona alocari experti'
  ) then
    create policy "Admin poate gestiona alocari experti"
      on public.licitatie_expert_alocari
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'licitatie-experti',
  'licitatie-experti',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate citi documente experti'
  ) then
    create policy "Admin poate citi documente experti"
      on storage.objects for select
      using (bucket_id = 'licitatie-experti' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate incarca documente experti'
  ) then
    create policy "Admin poate incarca documente experti"
      on storage.objects for insert
      with check (bucket_id = 'licitatie-experti' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate sterge documente experti'
  ) then
    create policy "Admin poate sterge documente experti"
      on storage.objects for delete
      using (bucket_id = 'licitatie-experti' and auth.role() = 'authenticated');
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

drop trigger if exists set_licitatie_expert_candidati_updated_at on public.licitatie_expert_candidati;
create trigger set_licitatie_expert_candidati_updated_at
before update on public.licitatie_expert_candidati
for each row execute function public.set_updated_at();

drop trigger if exists set_licitatie_expert_alocari_updated_at on public.licitatie_expert_alocari;
create trigger set_licitatie_expert_alocari_updated_at
before update on public.licitatie_expert_alocari
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
