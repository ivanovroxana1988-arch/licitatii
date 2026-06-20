create table if not exists public.companie_documente (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid references public.companie_profil(id) on delete cascade,
  tip text not null,
  titlu text not null,
  storage_bucket text not null default 'companie-documente',
  storage_path text not null,
  nume_fisier text not null,
  mime_type text not null default 'application/pdf',
  marime_bytes bigint,
  text_extras text,
  metadate_json jsonb not null default '{}'::jsonb,
  incarcat_la timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companie_documente_profil_id_idx
  on public.companie_documente(profil_id);

create index if not exists companie_documente_tip_idx
  on public.companie_documente(tip);

alter table public.companie_documente enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'companie_documente'
      and policyname = 'Admin poate gestiona documente companie'
  ) then
    create policy "Admin poate gestiona documente companie"
      on public.companie_documente
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'companie-documente',
  'companie-documente',
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
      and policyname = 'Admin poate citi documente companie'
  ) then
    create policy "Admin poate citi documente companie"
      on storage.objects for select
      using (bucket_id = 'companie-documente' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate incarca documente companie'
  ) then
    create policy "Admin poate incarca documente companie"
      on storage.objects for insert
      with check (bucket_id = 'companie-documente' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate sterge documente companie'
  ) then
    create policy "Admin poate sterge documente companie"
      on storage.objects for delete
      using (bucket_id = 'companie-documente' and auth.role() = 'authenticated');
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

drop trigger if exists set_companie_documente_updated_at on public.companie_documente;
create trigger set_companie_documente_updated_at
before update on public.companie_documente
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
