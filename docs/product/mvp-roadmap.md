# MVP roadmap

Obiectivul este sa transformam repo-ul existent intr-un produs coerent, fara sa reconstruim de la zero. Da, o idee socanta: refolosim ce exista si nu reinventam roata cu CSS mai lucios.

## Faza 0: Fundatie produs

Status: pornit prin acest branch.

Livrabile:

- README produs;
- viziune produs;
- model de date;
- plan de integrare repo-uri externe;
- migratie initiala Supabase pentru companii/asocieri/formatori/dosare.

Criteriu de acceptare:

- oricine intra in repo intelege ce construieste aplicatia si care sunt modulele.

## Faza 1: Companii si asocieri

Scop:

Aplicatia trebuie sa stie cine este "noi" inainte sa caute licitatii pentru "noi".

Functionalitati:

- CRUD companii;
- CRUD documente companie;
- CRUD experienta similara;
- CRUD asocieri;
- selectie lider asociere;
- overview capacitate asociere.

Pagini recomandate:

- `/admin/companies`
- `/admin/companies/[id]`
- `/admin/associations`
- `/admin/associations/[id]`

API recomandat:

- `GET/POST /api/admin/companies`
- `GET/PATCH/DELETE /api/admin/companies/[id]`
- `GET/POST /api/admin/associations`
- `GET/PATCH/DELETE /api/admin/associations/[id]`

Criteriu de acceptare:

- pot crea doua companii;
- pot crea o asociere cu lider;
- pot vedea ce experienta si documente exista pe fiecare membru.

## Faza 2: Radar SEAP legat de profil

Scop:

Radarul existent trebuie sa foloseasca datele companiei/asocierii, nu doar `RADAR_CONFIG` static.

Functionalitati:

- selectare companie sau asociere in radar;
- generare filtru CPV/cuvinte-cheie din profil;
- scoring licitatie-companie;
- scoring licitatie-asociere;
- import licitatie in workspace;
- afisare recomandare initiala.

Criteriu de acceptare:

- selectez o companie/asociere;
- radarul returneaza licitatii relevante;
- fiecare licitatie are scor si recomandare.

## Faza 3: Motor de eligibilitate si bid/no-bid

Inspiratie: ProcureX.

Agenti recomandati:

1. `TenderExtractorAgent` extrage cerinte;
2. `EligibilityAgent` compara cerintele cu compania/asocierea;
3. `ResourceAgent` verifica formatori si resurse;
4. `StrategyAgent` produce recomandare si actiuni.

Output:

- scoruri;
- riscuri;
- documente lipsa;
- intrebari de clarificare;
- decizie: depune / depune cu asociere / nu depune.

Criteriu de acceptare:

- pentru o licitatie importata, aplicatia genereaza un raport de eligibilitate structurat.

## Faza 4: Formatori

Scop:

Pentru achizitii de formare, aplicatia trebuie sa stie daca ai oamenii potriviti.

Functionalitati:

- CRUD formatori;
- competente si documente;
- matching formator-licitatie;
- identificare roluri lipsa;
- generare mesaj recrutare;
- checklist documente formator.

Pagini recomandate:

- `/admin/trainers`
- `/admin/trainers/[id]`
- `/admin/tenders/[id]/trainers`

Criteriu de acceptare:

- aplicatia poate spune ce formatori se potrivesc si ce formatori lipsesc.

## Faza 5: Constructie dosar

Scop:

Transforma analiza in documente.

Functionalitati:

- checklist dosar;
- opis automat;
- documente generate din template-uri;
- propunere tehnica draft;
- propunere financiara draft;
- status documente;
- status semnatura;
- verificare finala.

Pagini recomandate:

- `/admin/tenders/[id]/dossier`
- `/admin/dossiers/[id]`

Criteriu de acceptare:

- pentru o licitatie importata, aplicatia genereaza structura dosarului si lista documentelor necesare.

## Ordine de implementare recomandata

1. Migrare baza de date;
2. UI companii;
3. UI asocieri;
4. conectare radar la profil;
5. scoring simplu;
6. formatori;
7. dosar.

## Ce evitam acum

- integrare completa cu Documenso;
- semnatura electronica calificata automata;
- marketplace public de formatori;
- multi-tenant complex;
- plati si abonamente.

Fiecare lucru la timpul lui. Altfel facem un monstru SaaS care nu stie nici sa importe o firma, dar are landing page cu gradient. Nu, multumim.
