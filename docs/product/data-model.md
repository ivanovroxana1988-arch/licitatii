# Model de date: Licitatii AI

Acest document defineste modelul minim pentru modulele de companii, asocieri, formatori, matching si dosar.

## Principiu

Modelul trebuie sa permita trei scenarii:

1. o companie depune singura;
2. mai multe companii depun in asociere;
3. o companie/asociere are nevoie de formatori sau subcontractanti pentru a acoperi cerintele.

## Entitati principale

## `companies`

Reprezinta o companie, PFA, ONG sau alta entitate care poate participa in oferta.

Campuri recomandate:

- `id`
- `name`
- `cui`
- `registration_no`
- `legal_form`
- `address`
- `representative_name`
- `representative_role`
- `email`
- `phone`
- `website`
- `caen_codes`
- `cpv_codes`
- `notes`

## `company_documents`

Documente reutilizabile pentru companie.

Exemple:

- certificat constatator;
- certificat fiscal;
- declaratii;
- imputerniciri;
- bilanturi;
- certificate ISO;
- documente semnate.

Campuri recomandate:

- `id`
- `company_id`
- `kind`
- `title`
- `storage_path`
- `issue_date`
- `expiry_date`
- `signed_status`
- `metadata`

## `company_experience_contracts`

Experienta similara dovedibila a unei companii.

Campuri recomandate:

- `id`
- `company_id`
- `title`
- `beneficiary`
- `domain`
- `cpv_code`
- `value`
- `currency`
- `start_date`
- `end_date`
- `description`
- `evidence_document_id`
- `metadata`

## `associations`

O grupare de companii folosita pentru o licitatie sau un tip de licitatie.

Campuri recomandate:

- `id`
- `name`
- `leader_company_id`
- `purpose`
- `notes`

## `association_members`

Leaga companiile de o asociere.

Campuri recomandate:

- `association_id`
- `company_id`
- `role`
- `responsibility`
- `share_percent`
- `is_leader`

## `trainers`

Baza de formatori/experti.

Campuri recomandate:

- `id`
- `full_name`
- `email`
- `phone`
- `city`
- `availability_status`
- `rate_day`
- `rate_hour`
- `notes`

## `trainer_skills`

Competente cautabile pentru formatori.

Campuri recomandate:

- `trainer_id`
- `skill`
- `level`
- `years_experience`

## `trainer_documents`

Documente pentru formatori.

Exemple:

- CV;
- diploma;
- certificat formator;
- declaratie disponibilitate;
- GDPR;
- conflict de interese.

Campuri recomandate:

- `id`
- `trainer_id`
- `kind`
- `title`
- `storage_path`
- `issue_date`
- `expiry_date`
- `metadata`

## `tender_company_matches`

Rezultatul comparatiei dintre o licitatie si o companie/asociere.

Campuri recomandate:

- `id`
- `tender_id`
- `company_id`
- `association_id`
- `scores`
- `risks`
- `recommendation`
- `generated_at`

Exemplu `scores`:

```json
{
  "cpv": 85,
  "caen": 70,
  "similar_experience": 90,
  "financial_capacity": 60,
  "trainers": 75,
  "documents": 65,
  "overall": 74
}
```

Exemplu `recommendation`:

- `bid`
- `bid_with_association`
- `no_bid`
- `needs_clarification`

## `dossiers`

Dosarul construit pentru o licitatie.

Campuri recomandate:

- `id`
- `tender_id`
- `company_id`
- `association_id`
- `status`
- `checklist`
- `risk_summary`

## `dossier_documents`

Documentele generate sau atasate la dosar.

Campuri recomandate:

- `id`
- `dossier_id`
- `kind`
- `title`
- `storage_path`
- `status`
- `requires_signature`
- `signed_status`
- `metadata`

## Relatii cheie

- o companie are mai multe documente;
- o companie are mai multe contracte de experienta similara;
- o asociere are mai multe companii;
- un formator are mai multe competente si documente;
- o licitatie poate avea mai multe matching-uri, pentru companii sau asocieri diferite;
- un dosar apartine unei licitatii si unei companii/asocieri;
- un dosar contine mai multe documente.

## Regula importanta pentru asociere

Pentru fiecare licitatie trebuie sa poti raspunde:

- cine este liderul asocierii;
- ce cerinte acopera fiecare companie;
- ce experienta similara vine de la fiecare companie;
- ce documente trebuie depuse de fiecare membru;
- ce cerinte raman neacoperite.

## Regula importanta pentru formatori

Pentru licitatiile de formare trebuie sa poti raspunde:

- ce profiluri de formatori sunt cerute;
- ce formatori existenti se potrivesc;
- ce formatori lipsesc;
- ce documente lipsesc pentru fiecare formator;
- care este riscul de resurse umane.
