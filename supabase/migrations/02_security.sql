-- ============================================================
--  MOTOR DE LICITAȚII — Securitate (Etapa 1, partea 2)
--  Row Level Security (RLS) + Storage
--  Rulează DUPĂ 01_schema.sql
-- ============================================================

-- ============================================================
--  MODEL DE ACCES
--  - ADMIN (tu): autentificat prin Supabase Auth → acces complet.
--  - FORMATOR: NU e autentificat. Accesează prin token (cod unic).
--    Verificarea tokenului se face în aplicație (server-side),
--    folosind cheia service_role care ocolește RLS în siguranță.
--
--  Principiu: blocăm TOT accesul anonim direct la tabele.
--  Cititul/scrisul pentru formatori trece prin rute server (API)
--  care validează tokenul înainte. Așa, nimeni nu poate citi
--  datele altui formator ghicind un id.
-- ============================================================

-- Activăm RLS pe toate tabelele
alter table licitatii              enable row level security;
alter table factori                enable row level security;
alter table criterii_eligibilitate enable row level security;
alter table formatori              enable row level security;
alter table contracte              enable row level security;
alter table documente              enable row level security;
alter table aplicari               enable row level security;

-- ------------------------------------------------------------
--  POLITICI PENTRU ADMIN (utilizatori autentificați)
--  Orice user logat prin Supabase Auth = admin în acest MVP.
--  (În faza 2 putem adăuga roluri fine.)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'licitatii','factori','criterii_eligibilitate',
    'formatori','contracte','documente','aplicari'
  ]
  loop
    execute format($f$
      drop policy if exists admin_all on %1$I;
      create policy admin_all on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;

-- ------------------------------------------------------------
--  ACCES ANONIM: blocat la nivel de tabel.
--  Nu creăm nicio politică pentru rolul "anon", deci accesul
--  direct anonim e respins implicit. Formatorii lucrează DOAR
--  prin rutele server care folosesc service_role.
-- ------------------------------------------------------------

-- ============================================================
--  STORAGE — bucket pentru documentele încărcate
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documente', 'documente', false)
on conflict (id) do nothing;

-- Doar adminii autentificați pot citi direct din bucket.
-- Încărcarea de către formatori se face prin rute server (service_role),
-- la fel ca datele — tokenul e validat înainte.
drop policy if exists admin_storage_read on storage.objects;
create policy admin_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documente');

drop policy if exists admin_storage_write on storage.objects;
create policy admin_storage_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documente');
