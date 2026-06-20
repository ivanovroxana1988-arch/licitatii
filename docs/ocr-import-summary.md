# OCR import summary si dosar final

Modulul OCR separat permite crearea unei licitatii din documente scanate, fara parser OCR pe server.

Avantaj: deploy mai simplu pe Vercel/serverless.

Dezavantaj: OCR-ul depinde de browser, calitatea scanarii si timpul de procesare local.

In acelasi branch exista si upload de PDF-uri pentru sectiunea Dosar final din Tender Workspace:

- tabela `licitatie_dosar_documente`;
- bucket privat Supabase Storage `licitatie-dosar-final`;
- upload, inlocuire si stergere PDF pe fiecare document cerut;
- link semnat pentru deschiderea PDF-ului incarcat.
