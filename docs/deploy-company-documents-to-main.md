# Deploy documente companie in main

Branch-ul `feature/company-profile-autofill` contine modificarile pentru upload documente companie, dar `main` are doar profilul companiei de baza.

Diferenta principala:
- `app/api/admin/companie/documente/route.ts`
- `components/CompanyProfileForm.tsx` cu upload PDF
- `supabase/migrations/20260620213000_company_document_uploads.sql`
- logica de atasare in dosar final

Dupa ce acest branch este dus in `main`, redeploy-ul Vercel va afisa sectiunea `Documente companie PDF` in `/admin/companie`.
