# Association overview

Acest pas adauga un overview operational pentru fiecare asociere.

## Scop

Inainte de matching cu o licitatie, aplicatia trebuie sa arate rapid ce acopera asocierea si ce lipseste.

## Pagini si endpoint-uri

- `/admin/asocieri/[id]/overview`
- `GET /api/admin/asocieri/[id]/overview`

## Ce calculeaza overview-ul

- numar membri;
- lider asociere;
- total ponderi;
- coduri CAEN agregate;
- coduri CPV agregate;
- numar contracte de experienta similara;
- valoare totala experienta similara;
- riscuri administrative de baza;
- puncte acoperite.

## Riscuri semnalate

- lider lipsa;
- asociere cu mai putin de doua companii;
- ponderi diferite de 100%;
- lipsa CAEN;
- lipsa CPV;
- lipsa experienta similara;
- responsabilitati necompletate.

## Urmatorul pas

Acest overview trebuie folosit ca input pentru matching-ul licitatie-asociere:

1. selectezi licitatia;
2. selectezi compania sau asocierea;
3. sistemul compara cerintele licitatiei cu overview-ul companiei/asocierii;
4. sistemul produce scor, riscuri si recomandare bid/no-bid.
