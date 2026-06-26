# Licitatii AI

Platforma pentru identificarea licitatiilor potrivite, verificarea eligibilitatii individuale sau in asociere, recrutarea formatorilor si constructia dosarului de ofertare.

## Viziune scurta

Produsul trebuie sa acopere traseul complet:

1. definesti una sau mai multe companii;
2. creezi o asociere, daca este cazul;
3. cauti licitatii relevante in SEAP/e-licitatie;
4. verifici eligibilitatea si experienta similara;
5. identifici formatorii necesari;
6. construiesti dosarul de ofertare.

Formula de produs: **de la SEAP la dosar complet**.

## Module principale

### 1. Date companie si asociere

Baza aplicatiei. Utilizatorul poate salva mai multe profile de companii, poate selecta una sau mai multe companii pentru o licitatie si poate vedea capacitatea agregata a asocierii.

Entitati principale:

- companii;
- documente companie;
- experienta similara;
- coduri CAEN/CPV;
- asocieri;
- membri asociere;
- roluri si responsabilitati in oferta.

### 2. Radar SEAP

Modulul cauta licitatii relevante pentru una sau mai multe companii. Repo-ul are deja un inceput bun prin `lib/seap.ts` si ruta `app/api/admin/radar/route.ts`.

Urmatorul pas este ca radarul sa nu foloseasca doar reguli statice, ci profilul companiei sau al asocierii selectate.

### 3. Recrutare si matching formatori

Pentru achizitiile de formare, aplicatia trebuie sa identifice ce formatori sunt necesari, ce formatori exista deja in baza interna si ce roluri lipsesc.

Entitati principale:

- formatori;
- competente;
- certificari;
- CV-uri;
- disponibilitate;
- potrivire formator-licitatie.

### 4. Constructie dosar

Aplicatia genereaza checklist, opis, documente standard, declaratii, acord de asociere, propunere tehnica si propunere financiara.

AI-ul ajuta la redactare si analiza, dar documentele finale trebuie controlate prin template-uri. In achizitii publice, creativitatea necontrolata este doar o metoda eleganta de a pierde.

## Stack curent

- Next.js
- React
- TypeScript
- Supabase
- PDF parsing/OCR cu `pdf-parse`, `pdfjs-dist`, `tesseract.js`, `pdf-lib`

## Directie tehnica recomandata

Pastreaza acest repo ca produs principal si integreaza selectiv idei din repo-uri open-source:

- `watat83/document-chat-system` pentru RAG/document pipeline;
- `sarva-20/ProcureX` pentru agentic bid/no-bid scoring;
- `algodas/rag-licitacao` pentru memorie de licitatii si dovezi;
- `twentyhq/twenty` ca inspiratie CRM pentru companii/formatori;
- `documenso/documenso` ca inspiratie pentru workflow documente si semnare.

## Documentatie produs

Vezi:

- `docs/product/vision.md`
- `docs/product/data-model.md`
- `docs/product/mvp-roadmap.md`
- `docs/product/repo-integration-plan.md`

## Prima regula

Nu construim tot din prima. Construim intai scheletul care face produsul coerent:

1. profile companii;
2. asociere;
3. matching licitatie-companie;
4. matching formatori;
5. generator dosar.
