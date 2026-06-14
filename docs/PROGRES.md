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
