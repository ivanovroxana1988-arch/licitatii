create table if not exists public.experienta_similara_contracte (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid references public.companie_profil(id) on delete set null,
  titlu text not null,
  beneficiar text,
  obiect text,
  valoare_fara_tva numeric,
  moneda text not null default 'RON',
  data_contract text,
  data_finalizare text,
  domenii_text text,
  storage_bucket text not null default 'experienta-similara',
  storage_path text,
  nume_fisier text,
  mime_type text not null default 'application/pdf',
  marime_bytes bigint,
  text_extras text,
  analiza_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experienta_similara_contracte_profil_id_idx
  on public.experienta_similara_contracte(profil_id);

alter table public.experienta_similara_contracte enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'experienta_similara_contracte'
      and policyname = 'Admin poate gestiona experienta similara'
  ) then
    create policy "Admin poate gestiona experienta similara"
      on public.experienta_similara_contracte
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'experienta-similara',
  'experienta-similara',
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
      and policyname = 'Admin poate citi experienta similara'
  ) then
    create policy "Admin poate citi experienta similara"
      on storage.objects for select
      using (bucket_id = 'experienta-similara' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate incarca experienta similara'
  ) then
    create policy "Admin poate incarca experienta similara"
      on storage.objects for insert
      with check (bucket_id = 'experienta-similara' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin poate sterge experienta similara'
  ) then
    create policy "Admin poate sterge experienta similara"
      on storage.objects for delete
      using (bucket_id = 'experienta-similara' and auth.role() = 'authenticated');
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

drop trigger if exists set_experienta_similara_contracte_updated_at on public.experienta_similara_contracte;
create trigger set_experienta_similara_contracte_updated_at
before update on public.experienta_similara_contracte
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
