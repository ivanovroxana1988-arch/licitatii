# Plan integrare repo-uri externe

Scop: sa nu construim de la zero, dar nici sa nu facem Frankenstein cu dependinte uriase. Repo-ul `licitatii` ramane produsul principal. Celelalte repo-uri sunt surse de idei, module si arhitectura.

## Principiu de integrare

Nu facem fork complet decat daca exista un motiv foarte clar.

Preferam:

- copiere adaptata de pattern-uri;
- portare de module mici;
- refolosire de concepte;
- integrare prin API;
- documentare explicita a deciziilor.

## 1. `watat83/document-chat-system`

Rol: document pipeline si RAG.

Ce luam:

- modelul de upload documente;
- procesarea PDF/DOCX/OCR;
- chunking si indexing;
- vector search;
- raspunsuri cu surse/citari;
- background jobs pentru procesare documente.

Ce nu luam direct:

- tot sistemul de billing;
- toata arhitectura multi-tenant;
- UI-ul complet;
- configuratia completa Clerk/Stripe daca nu e necesara.

Adaptare pentru `licitatii`:

- `lib/documents/ingest.ts`
- `lib/documents/extract.ts`
- `lib/rag/retrieve.ts`
- `lib/rag/answer.ts`
- tabele pentru `tender_documents`, `document_chunks`, `document_embeddings` daca alegem pgvector.

Prioritate: mare.

## 2. `sarva-20/ProcureX`

Rol: motor agentic pentru analiza licitatiei si decizie bid/no-bid.

Ce luam:

- pipeline-ul cu agenti;
- separarea pe extractor, eligibility, market/risk, strategy;
- ideea de raport structurat;
- guardrails pentru documente invalide.

Ce nu luam direct:

- specificul pentru India;
- frontend-ul Vite;
- dependenta obligatorie de Gemini/AWS Strands;
- modelul de deployment Render/Vercel.

Adaptare pentru `licitatii`:

- `lib/agents/tender-extractor.ts`
- `lib/agents/eligibility-agent.ts`
- `lib/agents/resource-agent.ts`
- `lib/agents/strategy-agent.ts`
- `lib/matching/bid-no-bid.ts`

Prioritate: mare.

## 3. `algodas/rag-licitacao`

Rol: memorie de licitatii si cautare cu dovezi.

Ce luam:

- ideea de licitatie noua vs licitatii vechi;
- afisare extrase relevante;
- digest semantic;
- raspunsuri ancorate in documente;
- download sursa pentru validare.

Ce nu luam direct:

- Streamlit ca frontend;
- setup-ul strict pe OpenAI Vector Store daca alegem pgvector/Supabase;
- structura simplificata old/new daca vrem mai multe proiecte.

Adaptare pentru `licitatii`:

- `lib/rag/similar-tenders.ts`
- `lib/rag/evidence-search.ts`
- `app/admin/tenders/[id]/similar/page.tsx`

Prioritate: mare.

## 4. `twentyhq/twenty`

Rol: inspiratie CRM pentru companii, formatori si obiecte custom.

Ce luam:

- logica de obiecte configurabile;
- views pe entitati;
- UI patterns pentru liste, detalii, filtre;
- ideea de CRM ca sistem de lucru, nu doar baza de date.

Ce nu luam direct:

- repo-ul complet;
- monorepo-ul complex;
- NestJS/Nx daca nu vrem sa schimbam stack-ul;
- workflow-urile enterprise.

Adaptare pentru `licitatii`:

- companii ca obiect principal;
- formatori ca obiect CRM;
- asocieri ca obiect relational;
- licitatii ca oportunitati;
- dosare ca proiecte de livrare.

Prioritate: medie.

## 5. `documenso/documenso`

Rol: document workflow si semnare.

Ce luam:

- inspiratie pentru status documente;
- viewer PDF;
- audit trail;
- flux documente de semnat;
- concepte pentru destinatari, campuri, semnaturi.

Ce nu luam direct:

- integrare completa in MVP;
- prezumtia ca rezolva semnatura electronica calificata ceruta in achizitii publice;
- toata aplicatia self-hosted.

Adaptare pentru `licitatii`:

- `dossier_documents.requires_signature`;
- `dossier_documents.signed_status`;
- statusuri: `draft`, `ready`, `sent_for_signature`, `signed`, `missing`, `expired`;
- ulterior integrare separata cu un furnizor de semnatura calificata, daca este cazul.

Prioritate: scazuta pentru MVP, mare pentru produs matur.

## Ordine recomandata de portare

### Etapa 1: Document pipeline

Portam din `document-chat-system` doar ce ajuta la:

- upload;
- extragere text;
- OCR;
- document chunks;
- cautare in documente.

### Etapa 2: Matching companie/asociere

Construim in repo-ul nostru, inspirat de `ProcureX`.

### Etapa 3: Memorie licitatii

Construim similar cu `rag-licitacao`:

- licitatii vechi;
- licitatie noua;
- cerinte comune;
- experiente similare;
- dovezi.

### Etapa 4: CRM simplificat

Nu importam Twenty. Construim obiectele noastre:

- `companies`;
- `associations`;
- `trainers`;
- `experience_contracts`.

### Etapa 5: Document workflow

Pornim simplu:

- checklist;
- status document;
- export;
- semnatura doar ca status manual.

Integrarea reala cu semnare vine dupa MVP.

## Decizie arhitecturala

Repo-ul `licitatii` ramane Next.js + Supabase.

Nu schimbam stack-ul principal acum. O schimbare de stack in mijlocul MVP-ului este echivalentul tehnic al mutatului mobilei in timp ce casa arde.
