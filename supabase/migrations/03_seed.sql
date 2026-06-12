-- ============================================================
--  MOTOR DE LICITAȚII — Date de pornire (Etapa 1, partea 3)
--  Licitația NUCLEARELECTRICA CR 46167 cu factorii ei.
--  Rulează DUPĂ 01_schema.sql. Opțional — doar pentru a avea
--  cu ce testa imediat.
-- ============================================================

do $$
declare
  lic_id uuid;
begin
  -- Licitația
  insert into licitatii (nume, referinta, beneficiar, pondere_pret, status)
  values (
    'Leadership Academy Training 2026',
    'CR 46167',
    'NUCLEARELECTRICA — CNE Cernavodă',
    60,
    'activa'
  )
  returning id into lic_id;

  -- Factorii tehnici
  insert into factori (licitatie_id, cod, denumire, punctaj_max, tip, agregare, config_json, ordine, ajutor) values
  (lic_id, 'F2.1', 'Formare academică', 10, 'domain_map', 'avg',
   '{"map":[
      {"key":"psihologie","label":"Psihologie / psihosociologie","pts":10},
      {"key":"management","label":"Management / MBA / comunicare / inginerie","pts":5},
      {"key":"altcert","label":"Alt domeniu + certificare leadership","pts":3},
      {"key":"alt","label":"Alt domeniu, fără certificare","pts":0}
    ]}'::jsonb,
   1, 'Domeniul diplomei. Media pe toți formatorii.'),

  (lic_id, 'F2.2', 'Organizații complexe', 10, 'threshold_count', 'max',
   '{"unit":"organizații","tiers":[
      {"cutoff":4,"pts":10,"op":">="},
      {"cutoff":3,"pts":7,"op":">="},
      {"cutoff":2,"pts":3,"op":">="}
    ]}'::jsonb,
   2, 'Nr. organizații complexe unde a predat. Cel mai bun formator.'),

  (lic_id, 'F2.3', 'Ore predare', 10, 'threshold_value', 'max',
   '{"unit":"ore","tiers":[
      {"cutoff":3000,"pts":10,"op":">"},
      {"cutoff":2000,"pts":7,"op":">"},
      {"cutoff":1000,"pts":5,"op":">"}
    ]}'::jsonb,
   3, 'Ore cumulate de predare leadership. Cel mai bun formator.'),

  (lic_id, 'F2.4', 'Tematici acoperite', 10, 'threshold_count', 'max',
   '{"unit":"tematici","tiers":[
      {"cutoff":7,"pts":10,"op":">="},
      {"cutoff":5,"pts":6,"op":">="},
      {"cutoff":3,"pts":3,"op":">="}
    ]}'::jsonb,
   4, 'Câte din cele 8 tematici a predat. Cel mai bun formator.');

  -- Criterii de eligibilitate (pragul minim 6.3.1)
  insert into criterii_eligibilitate (licitatie_id, eticheta, tip, factor_cod, valoare_min, ordine) values
  (lic_id, 'Certificat Formator COR 242401', 'bool', null, null, 1),
  (lic_id, 'Min. 1000 ore predare leadership', 'min_factor', 'F2.3', 1000, 2),
  (lic_id, 'Min. 1 organizație complexă', 'min_factor', 'F2.2', 1, 3),
  (lic_id, 'Min. 2 tematici abordate', 'min_factor', 'F2.4', 2, 4);

  raise notice 'Licitație creată cu id %', lic_id;
end $$;
