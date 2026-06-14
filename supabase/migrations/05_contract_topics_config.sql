-- ============================================================
--  Etapa 3 fix - tematici predefinite pe contracte
-- ============================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'licitatii'
      and column_name = 'formular_config_json'
  ) then
    update licitatii l
    set formular_config_json = jsonb_set(
      l.formular_config_json,
      '{sections}',
      (
        select jsonb_agg(
          jsonb_set(
            section_item.section,
            '{fields}',
            (
              select jsonb_agg(
                case
                  when field_item.field ->> 'type' = 'contract_list'
                    and not (field_item.field ? 'topicOptions')
                  then field_item.field || '{
                    "topicOptions": [
                      {"value":"management-effectiveness","label":"Management Effectiveness"},
                      {"value":"teamwork","label":"Teamwork"},
                      {"value":"inteligenta-emotionala","label":"Inteligenta emotionala"},
                      {"value":"self-awareness","label":"Self-awareness"},
                      {"value":"self-correction","label":"Self-Correction"},
                      {"value":"comunicare","label":"Comunicare"},
                      {"value":"public-speaking","label":"Public Speaking"},
                      {"value":"coaching","label":"Coaching"}
                    ]
                  }'::jsonb
                  else field_item.field
                end
                order by field_item.field_ordinality
              )
              from jsonb_array_elements(section_item.section -> 'fields')
                with ordinality as field_item(field, field_ordinality)
            ),
            true
          )
          order by section_item.section_ordinality
        )
        from jsonb_array_elements(l.formular_config_json -> 'sections')
          with ordinality as section_item(section, section_ordinality)
      ),
      true
    )
    where l.formular_config_json is not null
      and exists (
        select 1
        from jsonb_array_elements(l.formular_config_json -> 'sections') section_item(section)
        cross join jsonb_array_elements(section_item.section -> 'fields') field_item(field)
        where field_item.field ->> 'type' = 'contract_list'
          and not (field_item.field ? 'topicOptions')
      );

    alter table licitatii
      alter column formular_config_json set default '{
        "version": 1,
        "sections": [
          {
            "id": "date-identificare",
            "title": "Date de identificare",
            "description": "Datele care vor aparea in CV si in declaratiile generate.",
            "fields": [
              {"id":"nume","label":"Nume","type":"text","source":"standard","bind":"nume","required":true},
              {"id":"prenume","label":"Prenume","type":"text","source":"standard","bind":"prenume","required":true},
              {"id":"email","label":"Email","type":"text","source":"standard","bind":"email","required":true},
              {"id":"telefon","label":"Telefon","type":"text","source":"standard","bind":"telefon"},
              {"id":"domeniu_studii","label":"Domeniu studii","type":"select","source":"standard","bind":"domeniu_studii","optionsSource":"study_domains","required":true,"scoring":{"factorCod":"F2.1","mode":"select_map"}},
              {"id":"studii_detalii","label":"Detalii studii","type":"textarea","source":"standard","bind":"studii_detalii","help":"Diplome, programe, institutii si ani relevanti."},
              {"id":"are_cor_242401","label":"Detin certificat Formator COR 242401","type":"checkbox","source":"standard","bind":"are_cor_242401","required":true},
              {"id":"ani_management","label":"Ani experienta management","type":"number","source":"standard","bind":"ani_management","min":0},
              {"id":"bio","label":"Profil profesional scurt","type":"textarea","source":"standard","bind":"bio"}
            ]
          },
          {
            "id": "contracte",
            "title": "Contracte si experienta",
            "description": "Un rand pentru fiecare contract relevant.",
            "fields": [
              {"id":"contracte","label":"Contracte","type":"contract_list","required":true,"topicOptions":[
                {"value":"management-effectiveness","label":"Management Effectiveness"},
                {"value":"teamwork","label":"Teamwork"},
                {"value":"inteligenta-emotionala","label":"Inteligenta emotionala"},
                {"value":"self-awareness","label":"Self-awareness"},
                {"value":"self-correction","label":"Self-Correction"},
                {"value":"comunicare","label":"Comunicare"},
                {"value":"public-speaking","label":"Public Speaking"},
                {"value":"coaching","label":"Coaching"}
              ]}
            ]
          },
          {
            "id": "documente",
            "title": "Documente justificative",
            "description": "Incarca documentele care sustin experienta, studiile si certificarile.",
            "fields": [
              {"id":"documente","label":"Documente","type":"document_upload","requiredDocumentTypes":["recomandare","contract","diploma","certificat"]}
            ]
          }
        ]
      }'::jsonb;
  end if;
end $$;
