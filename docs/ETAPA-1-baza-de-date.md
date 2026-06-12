# Etapa 1 — Fundația de date (Supabase)

Această etapă creează structura bazei de date. Durează ~10 minute și nu necesită cod, doar copy-paste în Supabase.

---

## Ce construim acum

Temelia aplicației: tabelele, relațiile dintre ele, regulile de securitate și un set de date de test (licitația NUCLEARELECTRICA). După această etapă, baza de date e gata; aplicația web vine în etapa următoare.

---

## Pasul 1 — Deschide proiectul Supabase

1. Intră pe [supabase.com](https://supabase.com) și deschide proiectul tău (sau creează unul nou: **New project**, alege o regiune din Europa, ex. Frankfurt, și notează-ți parola bazei de date).
2. Așteaptă ca proiectul să fie gata (1-2 minute la unul nou).

## Pasul 2 — Rulează cele 3 migrații, ÎN ORDINE

În stânga, apasă pe **SQL Editor** (iconița `</>`), apoi **+ New query**.

**Migrația 1 — structura:**
- Deschide fișierul `01_schema.sql`, copiază tot conținutul.
- Lipește-l în editorul SQL.
- Apasă **Run** (sau Ctrl/Cmd + Enter).
- Trebuie să vezi „Success. No rows returned".

**Migrația 2 — securitatea:**
- New query → copiază `02_security.sql` → lipește → **Run**.
- Tot „Success".

**Migrația 3 — datele de test (opțional, dar recomandat):**
- New query → copiază `03_seed.sql` → lipește → **Run**.
- La final, în zona de mesaje vei vedea „Licitație creată cu id ...".

> Ordinea contează: 01 înainte de 02 înainte de 03. Dacă rulezi din greșeală în altă ordine, nu strică nimic — doar reia de la 01.

## Pasul 3 — Verifică că totul e pe loc

1. În stânga, apasă **Table Editor**.
2. Trebuie să vezi 7 tabele: `licitatii`, `factori`, `criterii_eligibilitate`, `formatori`, `contracte`, `documente`, `aplicari`.
3. Apasă pe `licitatii` — trebuie să existe un rând: „Leadership Academy Training 2026".
4. Apasă pe `factori` — trebuie să existe 4 rânduri (F2.1 … F2.4).

Dacă vezi astea, **Etapa 1 e gata.** ✅

## Pasul 4 — Notează-ți cheile (le folosim în Etapa 2)

În stânga: **Project Settings** (rotița) → **API**. Notează-ți, undeva sigur:

- **Project URL** (arată ca `https://xxxxx.supabase.co`)
- **anon public** key (cheia publică)
- **service_role** key (cheia secretă — ⚠️ NU o pune niciodată în cod public sau pe GitHub)

Nu mi le trimite mie — le vei pune tu, în Etapa 2, într-un fișier local de configurare.

---

## Ce am construit și de ce (pe scurt)

- **licitatii / factori / criterii_eligibilitate** — o licitație cu factorii și pragurile ei, toate editabile din aplicație mai târziu. Asta face „motorul configurabil".
- **formatori / contracte / documente** — profilul reutilizabil al unui formator, contractele lui și fișierele încărcate.
- **aplicari** — leagă un formator de o licitație, cu un *token unic* (codul din link) și un câmp `selectat` prin care tu decizi cine rămâne.
- **Securitate (RLS):** tu, ca admin logat, vezi tot. Formatorii NU au acces direct la bază — accesează doar prin link-ul cu token, validat de aplicație. Astfel nimeni nu poate citi datele altui formator.
- **Trigger automat:** când un formator scrie tematicile unui contract, numărul lor se calculează singur (pentru punctajul F2.4).

---

## Dacă ceva nu merge

- **Eroare „relation already exists"** — ai rulat deja migrația; e ok, poți continua.
- **Eroare la 03_seed** despre „licitatii" — înseamnă că 01 nu a rulat; reia de la migrația 1.
- Orice altă eroare: copiază textul exact al erorii și trimite-mi-l — îți spun precis ce e.

Când ai confirmat că vezi cele 7 tabele și licitația de test, spune-mi și trecem la **Etapa 2: scheletul aplicației + conectarea la Supabase + deploy pe Vercel.**
