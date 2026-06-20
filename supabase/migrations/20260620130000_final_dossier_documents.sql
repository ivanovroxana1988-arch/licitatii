create table if not exists public.licitatie_dosar_documente (
  id uuid primary key default gen_random_uuid(),
  licitatie_id uuid not null references public.licitatii(id) on delete cascade,
  document_key text not null,
  categorie text not null,
  titlu text not null,
  storage_bucket text not null default 'licitatie-dosar-final',
  storage_path text not null,
  nume_fisier text not null,
  mime_type text not null default 'application/pdf',
  marime_bytes bigint,
  incarcat_de uuid references auth.users(id) on delete set null,
  incarcat_la timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (licitatie_id, document_key)
);

create index if not exists licitatie_dosar_documente_licitatie_id_idx
  on public.licitatie_dosar_documente(licitatie_id);

alter table public.licitatie_dosar_documente enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'licitatie_dosar_documente'
      and policyname = 'Admin poate gestiona documente dosar final'
  ) then
    create policy "Admin poate gestiona documente dosar final"
      on public.licitatie_dosar_documente
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'licitatie-dosar-final',
  'licitatie-dosar-final',
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
      and policyname = 'Admin poate citi PDF dosar final'
  ) then
    create policy "Admin poate citi PDF dosar final"
      on storage.objects for select
      using (bucket_id = 'licitatie-dosar-final' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate incarca PDF dosar final'
  ) then
    create policy "Admin poate incarca PDF dosar final"
      on storage.objects for insert
      with check (bucket_id = 'licitatie-dosar-final' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate sterge PDF dosar final'
  ) then
    create policy "Admin poate sterge PDF dosar final"
      on storage.objects for delete
      using (bucket_id = 'licitatie-dosar-final' and auth.role() = 'authenticated');
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

drop trigger if exists set_licitatie_dosar_documente_updated_at on public.licitatie_dosar_documente;
create trigger set_licitatie_dosar_documente_updated_at
before update on public.licitatie_dosar_documente
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
