# Etapa 2 — Scheletul aplicației + deploy

La finalul acestei etape ai o aplicație **live pe internet**, în care te loghezi cu contul tău de admin și vezi licitația din baza de date. Durează ~30 de minute.

Parcurgem 4 mari pași: (A) pregătești codul local, (B) creezi contul de admin în Supabase, (C) îl rulezi pe calculatorul tău ca să verifici, (D) îl pui pe GitHub și faci deploy pe Vercel.

---

## Ce primești

Un proiect Next.js complet, deja testat (compilează fără erori). Conține: pagina de login, dashboard-ul de admin protejat, conexiunea la Supabase și motorul de scoring. Formularul formatorilor și restul vin în etapele următoare — dar fundația aplicației e gata și funcțională.

---

## A. Pregătește codul local

### A1. Instalează ce-ți trebuie (o singură dată)
- **Node.js** (versiunea 20 sau mai nouă): descarcă de pe [nodejs.org](https://nodejs.org) — alege „LTS". Instalează normal.
- **Git**: de pe [git-scm.com](https://git-scm.com). Instalează normal.
- Verifică în terminal (Terminal pe Mac, PowerShell pe Windows):
  ```
  node --version
  git --version
  ```
  Dacă ambele afișează un număr, ești gata.

### A2. Deschide proiectul
- Dezarhivează folderul `licitatii-app` undeva ușor de găsit (ex. Desktop).
- Deschide un terminal **în acel folder**:
  - Windows: deschide folderul în File Explorer → click dreapta → „Open in Terminal" (sau „Deschide în Terminal").
  - Mac: deschide folderul în Finder → click dreapta → „New Terminal at Folder".
- Instalează dependențele (descarcă bibliotecile necesare):
  ```
  npm install
  ```
  Durează 1-2 minute. E normal să apară câteva avertismente.

### A3. Conectează-l la Supabase-ul tău
- În folder există un fișier `.env.local.example`. Fă o copie a lui și redenumește copia în `.env.local`.
- Deschide `.env.local` cu un editor de text (Notepad / TextEdit / VS Code) și completează cu valorile tale din Supabase (Project Settings → API):
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=cheia_anon_public
  SUPABASE_SERVICE_ROLE_KEY=cheia_service_role
  ```
- Salvează. **Acest fișier rămâne doar la tine — nu ajunge pe GitHub** (e deja exclus).

---

## B. Creează contul de admin

Aplicația nu are „înregistrare" — adminul (tu) se creează direct în Supabase, ca să nu poată intra altcineva.

1. În Supabase, stânga: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Pune email-ul și o parolă pe care le ții minte. Bifează **Auto Confirm User** (ca să nu mai aștepți email de confirmare).
3. **Create user.** Gata — cu astea te vei loga în aplicație.

---

## C. Rulează-l local (verificare)

În terminal, în folderul proiectului:
```
npm run dev
```
Vei vedea un mesaj cu o adresă, de obicei `http://localhost:3000`. Deschide-o în browser.

- Ar trebui să te ducă la pagina de **login**.
- Intră cu email-ul și parola create la pasul B.
- După login, vezi **Tabloul de bord** cu licitația de test „Leadership Academy Training 2026".

Dacă vezi licitația, aplicația funcționează cap-coadă: login + bază de date. ✅

Oprește serverul local cu `Ctrl + C` în terminal când termini.

> Nu apare licitația? Verifică `.env.local` (cheile corecte) și că ai rulat migrația 03_seed în Etapa 1.

---

## D. Pune-l pe GitHub și fă deploy pe Vercel

### D1. Pe GitHub
1. Pe [github.com](https://github.com), creează un repository nou (butonul **New**): nume ex. `licitatii-app`, lasă-l **Private**. Nu bifa „Add README".
2. În terminal, în folderul proiectului, rulează pe rând:
   ```
   git init
   git add .
   git commit -m "Etapa 2: schelet aplicatie"
   git branch -M main
   git remote add origin https://github.com/UTILIZATORUL_TAU/licitatii-app.git
   git push -u origin main
   ```
   (Înlocuiește `UTILIZATORUL_TAU` cu numele tău GitHub. Linkul exact îl vezi pe pagina repo-ului nou creat.)
   - La push, GitHub îți poate cere autentificare. Dacă cere parolă, folosește un **Personal Access Token** (GitHub → Settings → Developer settings → Tokens), nu parola contului.

### D2. Pe Vercel
1. Pe [vercel.com](https://vercel.com), intră cu contul GitHub.
2. **Add New** → **Project** → alege repo-ul `licitatii-app` → **Import**.
3. Înainte de **Deploy**, deschide secțiunea **Environment Variables** și adaugă cele 3 chei (aceleași ca în `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Apasă **Deploy**. Așteaptă ~2 minute.
5. Vercel îți dă un link de forma `https://licitatii-app-xxxx.vercel.app`. Deschide-l, loghează-te — e aceeași aplicație, acum live pe internet.

### D3. Un ultim pas în Supabase (URL-ul de redirect)
Ca login-ul să meargă pe domeniul live:
1. Supabase → **Authentication** → **URL Configuration**.
2. La **Site URL**, pune linkul de Vercel (`https://licitatii-app-xxxx.vercel.app`).
3. La **Redirect URLs**, adaugă același link. Salvează.

---

## Gata — ce ai acum

O aplicație reală, găzduită, cu autentificare și conexiune la baza ta de date. De fiecare dată când modifici codul și faci `git push`, Vercel redeployează automat. Asta e fluxul de lucru de aici înainte.

## Dacă ceva nu merge
- **„Invalid login credentials"** la login → contul de admin nu e creat sau parola e greșită (pasul B).
- **Pagina e albă / eroare 500** pe Vercel → cel mai probabil lipsește o cheie în Environment Variables (pasul D2). Adaugă-o și redeployează (Vercel → Deployments → Redeploy).
- **Eroare la `git push`** → verifică linkul `origin` și folosește un token de acces, nu parola.
- Orice altă eroare: copiază textul și trimite-mi-l.

Când confirmi că te loghezi pe linkul de Vercel și vezi licitația, trecem la **Etapa 3: formularul formatorilor — completare prin link cu token, cu upload de documente.**
