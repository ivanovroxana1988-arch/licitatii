# Progres dezvoltare

## Etapa 3 - formular configurabil si flux formator

Implementat:
- Configuratie formular per licitatie in `licitatii.formular_config_json`.
- Raspunsuri dinamice per aplicare in `aplicari.raspunsuri_formular_json`.
- API public token-based pentru citire, salvare, upload documente, stergere documente si finalizare.
- Pagina publica `/aplica/[token]`, generata din configuratia formularului.
- Editor admin complet pentru sectiuni, campuri, documente obligatorii si legare la factori.
- Generare link invitatie din dashboard.
- Motor de scoring extins cu surse dinamice, pastrand compatibilitatea cu F2.1-F2.4.
- Fix pentru campurile din formularul formatorului care pierdeau focusul la tastare.
- Contractele folosesc perioada structurata (numar + unitate) si tematici bifabile din lista per licitatie.

Fisiere principale noi:
- `supabase/migrations/04_formular_config.sql`
- `lib/form-schema.ts`
- `lib/aplicare.ts`
- `app/api/aplicare/[token]/**`
- `app/api/admin/licitatii/[id]/**`
- `app/aplica/[token]/page.tsx`
- `app/admin/licitatii/[id]/formular/page.tsx`
- `components/AplicareForm.tsx`
- `components/FormConfigEditor.tsx`
- `components/AdminLicitatieActions.tsx`
- `supabase/migrations/05_contract_topics_config.sql`

## Etapa 4 - dashboard administrare licitatie

Implementat:
- Pagina `/admin/licitatii/[id]` cu antet licitatie, scor tehnic pentru echipa selectata si defalcare pe factori.
- Lista aplicarilor cu status, eligibilitate, punctaj individual pe fiecare factor si toggle `Selectat`.
- API admin pentru salvarea selectiei in `aplicari.selectat`.
- Simulator pret simplu cu punctaj pret si total simulat.
- Bloc "Ce te tine pe loc" pe baza factorului cu cele mai multe puncte ramase.

Fisiere principale noi:
- `app/admin/licitatii/[id]/page.tsx`
- `app/api/admin/aplicari/[id]/selectie/route.ts`
- `components/LicitatieAdminPanel.tsx`

Ramane pentru Etapa 4:
- Editor complet pentru factori si criterii, separat de legarea rapida a formularului.
- Creare licitatie noua din dashboard.

## Etapa 5 - generare documente si export PDF

Implementat:
- Ruta admin `/api/export/[aplicareId]` care genereaza un PDF unic pentru dosarul formatorului.
- Generator server-side in `lib/export-dossier.ts`, cu pagini standardizate pentru coperta, CV, lista organizatiilor si declaratii-tip.
- Asamblare documente incarcate din Supabase Storage in ordinea: recomandari, contracte, diplome, certificate, alte documente.
- Include PDF-uri existente prin concatenare si imagini prin conversie server-side in PNG.
- Buton `Export dosar` pe fiecare aplicare finalizata din pagina `/admin/licitatii/[id]`.

Decizie tehnica:
- Folosim `pdf-lib` pentru generarea paginilor si concatentarea PDF-urilor, plus `sharp` pentru normalizarea imaginilor incarcate. Evitam browser/headless in serverless Vercel si pastram exportul intr-o ruta Node.js cu `maxDuration = 60`.

Ramane pentru Etapa 5:
- Sablonare vizuala mai fina daca dosarul oficial are un format impus.
- Export "toti selectatii" intr-o arhiva sau PDF separat per formator, daca va fi nevoie.
