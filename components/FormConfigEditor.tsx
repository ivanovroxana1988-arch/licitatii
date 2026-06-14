"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  DOCUMENT_TYPES,
  DEFAULT_TOPIC_OPTIONS,
  defaultFormularConfig,
  documentTypeLabel,
  type DocumentTip,
  type FieldType,
  type FormField,
  type FormFieldOption,
  type FormularConfig,
} from "@/lib/form-schema";
import type { Factor } from "@/lib/scoring";

type Props = {
  licitatieId: string;
  initialConfig: FormularConfig;
  factori: Factor[];
};

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "checkbox",
  "contract_list",
  "document_upload",
];

export default function FormConfigEditor({ licitatieId, initialConfig, factori }: Props) {
  const [config, setConfig] = useState<FormularConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/licitatii/${licitatieId}/formular`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formular_config_json: config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva formularul.");
      setConfig(data.formular_config_json);
      setMessage("Formularul a fost salvat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva formularul.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
      <div style={{ display: "grid", gap: 14 }}>
        {config.sections.map((section, sectionIndex) => (
          <section key={section.id} style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 9 }}>
                <Input
                  label="Titlu sectiune"
                  value={section.title}
                  onChange={(value) => updateSection(sectionIndex, { title: value })}
                />
                <Input
                  label="Descriere"
                  value={section.description ?? ""}
                  onChange={(value) => updateSection(sectionIndex, { description: value })}
                />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "end" }}>
                <SmallButton onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0}>
                  Sus
                </SmallButton>
                <SmallButton onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === config.sections.length - 1}>
                  Jos
                </SmallButton>
                <SmallButton tone="danger" onClick={() => removeSection(sectionIndex)}>
                  Sterge
                </SmallButton>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {section.fields.map((field, fieldIndex) => (
                <div key={field.id} style={fieldStyle}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <Input
                      label="Eticheta camp"
                      value={field.label}
                      onChange={(value) => updateField(sectionIndex, fieldIndex, { label: value })}
                    />
                    <label style={labelGridStyle}>
                      <span style={labelStyle}>Tip camp</span>
                      <select
                        value={field.type}
                        onChange={(event) => updateField(sectionIndex, fieldIndex, { type: event.target.value as FieldType })}
                        style={inputStyle}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    {field.type !== "contract_list" && field.type !== "document_upload" && (
                      <label style={labelGridStyle}>
                        <span style={labelStyle}>Sursa date</span>
                        <select
                          value={field.source ?? "dynamic"}
                          onChange={(event) =>
                            updateField(sectionIndex, fieldIndex, {
                              source: event.target.value as "standard" | "dynamic",
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="dynamic">Raspuns din formular</option>
                          <option value="standard">Camp standard formator</option>
                        </select>
                      </label>
                    )}
                    {field.source === "standard" && (
                      <Input
                        label="Cheie standard"
                        value={field.bind ?? ""}
                        onChange={(value) => updateField(sectionIndex, fieldIndex, { bind: value })}
                      />
                    )}
                  </div>

                  {field.type !== "contract_list" && field.type !== "document_upload" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
                      <Input
                        label="Ajutor"
                        value={field.help ?? ""}
                        onChange={(value) => updateField(sectionIndex, fieldIndex, { help: value })}
                      />
                      <Input
                        label="Minim numeric"
                        type="number"
                        value={field.min === undefined ? "" : String(field.min)}
                        onChange={(value) => updateField(sectionIndex, fieldIndex, { min: value === "" ? undefined : Number(value) })}
                      />
                      <Input
                        label="Maxim numeric"
                        type="number"
                        value={field.max === undefined ? "" : String(field.max)}
                        onChange={(value) => updateField(sectionIndex, fieldIndex, { max: value === "" ? undefined : Number(value) })}
                      />
                      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 20, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={(event) => updateField(sectionIndex, fieldIndex, { required: event.target.checked })}
                        />
                        Obligatoriu
                      </label>
                    </div>
                  )}

                  {field.type === "select" && (
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={field.optionsSource === "study_domains"}
                          onChange={(event) =>
                            updateField(sectionIndex, fieldIndex, {
                              optionsSource: event.target.checked ? "study_domains" : undefined,
                            })
                          }
                        />
                        Foloseste domeniile din factorul F2.1
                      </label>
                      {field.optionsSource !== "study_domains" && (
                        <label style={labelGridStyle}>
                          <span style={labelStyle}>Optiuni manuale: valoare|eticheta|puncte</span>
                          <textarea
                            rows={4}
                            value={optionsToText(field.options)}
                            onChange={(event) =>
                              updateField(sectionIndex, fieldIndex, { options: textToOptions(event.target.value) })
                            }
                            style={inputStyle}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {field.type === "document_upload" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                      {DOCUMENT_TYPES.map((tip) => (
                        <label key={tip} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={(field.requiredDocumentTypes ?? []).includes(tip)}
                            onChange={() => toggleRequiredDocument(sectionIndex, fieldIndex, tip)}
                          />
                          {documentTypeLabel(tip)} obligatoriu
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === "contract_list" && (
                    <label style={{ ...labelGridStyle, marginTop: 10 }}>
                      <span style={labelStyle}>Tematici predefinite: cate una pe linie</span>
                      <textarea
                        rows={7}
                        value={topicOptionsToText(field.topicOptions)}
                        onChange={(event) =>
                          updateField(sectionIndex, fieldIndex, {
                            topicOptions: textToTopicOptions(event.target.value),
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                  )}

                  {field.type !== "document_upload" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
                      <label style={labelGridStyle}>
                        <span style={labelStyle}>Factor scoring</span>
                        <select
                          value={field.scoring?.factorCod ?? ""}
                          onChange={(event) =>
                            updateField(sectionIndex, fieldIndex, {
                              scoring: { ...(field.scoring ?? {}), factorCod: event.target.value || undefined },
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="">Fara legatura</option>
                          {factori.map((factor) => (
                            <option key={factor.id} value={factor.cod}>
                              {factor.cod} - {factor.denumire}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={labelGridStyle}>
                        <span style={labelStyle}>Mod scoring</span>
                        <select
                          value={field.scoring?.mode ?? "value"}
                          onChange={(event) =>
                            updateField(sectionIndex, fieldIndex, {
                              scoring: {
                                ...(field.scoring ?? {}),
                                mode: event.target.value as NonNullable<FormField["scoring"]>["mode"],
                              },
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="value">Valoare numerica/prag</option>
                          <option value="select_map">Mapare optiuni</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </label>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, justifyContent: "end", marginTop: 10 }}>
                    <SmallButton onClick={() => moveField(sectionIndex, fieldIndex, -1)} disabled={fieldIndex === 0}>
                      Sus
                    </SmallButton>
                    <SmallButton onClick={() => moveField(sectionIndex, fieldIndex, 1)} disabled={fieldIndex === section.fields.length - 1}>
                      Jos
                    </SmallButton>
                    <SmallButton tone="danger" onClick={() => removeField(sectionIndex, fieldIndex)}>
                      Sterge camp
                    </SmallButton>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addField(sectionIndex)} style={secondaryButtonStyle}>
                Adauga camp
              </button>
            </div>
          </section>
        ))}

        <button type="button" onClick={addSection} style={secondaryButtonStyle}>
          Adauga sectiune
        </button>
      </div>

      <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <div style={cardStyle}>
          <h2 style={{ color: "#16324f", fontSize: 16, marginBottom: 8 }}>Publicare</h2>
          <p style={{ color: "#5a6573", fontSize: 13, lineHeight: 1.45 }}>
            La salvare, configuratia se sincronizeaza in Supabase si formularul public o foloseste imediat.
          </p>
          <button type="button" onClick={save} disabled={saving} style={{ ...primaryButtonStyle, marginTop: 14 }}>
            {saving ? "Se salveaza..." : "Salveaza configuratia"}
          </button>
          <button type="button" onClick={() => setConfig(defaultFormularConfig)} style={{ ...secondaryButtonStyle, marginTop: 10, width: "100%" }}>
            Revino la formularul standard
          </button>
        </div>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div style={cardStyle}>
          <h2 style={{ color: "#16324f", fontSize: 15, marginBottom: 8 }}>Factori disponibili</h2>
          <div style={{ display: "grid", gap: 7 }}>
            {factori.map((factor) => (
              <div key={factor.id} style={{ fontSize: 12, color: "#394554" }}>
                <strong>{factor.cod}</strong> {factor.denumire}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );

  function updateSection(index: number, patch: Partial<FormularConfig["sections"][number]>) {
    setConfig((current) => ({
      ...current,
      sections: current.sections.map((section, currentIndex) =>
        currentIndex === index ? { ...section, ...patch } : section
      ),
    }));
  }

  function addSection() {
    setConfig((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: makeId("sectiune"),
          title: "Sectiune noua",
          description: "",
          fields: [],
        },
      ],
    }));
  }

  function removeSection(index: number) {
    setConfig((current) => ({
      ...current,
      sections: current.sections.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setConfig((current) => ({ ...current, sections: moveItem(current.sections, index, direction) }));
  }

  function updateField(sectionIndex: number, fieldIndex: number, patch: Partial<FormField>) {
    setConfig((current) => ({
      ...current,
      sections: current.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex ? { ...field, ...patch } : field
              ),
            }
          : section
      ),
    }));
  }

  function addField(sectionIndex: number) {
    updateSection(sectionIndex, {
      fields: [
        ...config.sections[sectionIndex].fields,
        {
          id: makeId("camp"),
          label: "Camp nou",
          type: "text",
          source: "dynamic",
          required: false,
        },
      ],
    });
  }

  function removeField(sectionIndex: number, fieldIndex: number) {
    updateSection(sectionIndex, {
      fields: config.sections[sectionIndex].fields.filter((_, index) => index !== fieldIndex),
    });
  }

  function moveField(sectionIndex: number, fieldIndex: number, direction: -1 | 1) {
    updateSection(sectionIndex, {
      fields: moveItem(config.sections[sectionIndex].fields, fieldIndex, direction),
    });
  }

  function toggleRequiredDocument(sectionIndex: number, fieldIndex: number, tip: DocumentTip) {
    const field = config.sections[sectionIndex].fields[fieldIndex];
    const current = field.requiredDocumentTypes ?? [];
    const next = current.includes(tip) ? current.filter((item) => item !== tip) : [...current, tip];
    updateField(sectionIndex, fieldIndex, { requiredDocumentTypes: next });
  }
}

function Input(props: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={labelGridStyle}>
      <span style={labelStyle}>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "normal" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      style={props.tone === "danger" ? smallDangerButtonStyle : smallButtonStyle}
    >
      {props.children}
    </button>
  );
}

function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${tone === "success" ? "#b9dbc7" : "#f1b5ae"}`,
        color: tone === "success" ? "#1a7f37" : "#b3261e",
        background: tone === "success" ? "#f1faf4" : "#fff7f6",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function optionsToText(options?: FormFieldOption[]) {
  return (options ?? [])
    .map((option) => `${option.value}|${option.label}|${option.points ?? 0}`)
    .join("\n");
}

function textToOptions(value: string): FormFieldOption[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawValue, rawLabel, rawPoints] = line.split("|");
      return {
        value: (rawValue || rawLabel || "").trim(),
        label: (rawLabel || rawValue || "").trim(),
        points: Number(rawPoints ?? 0) || 0,
      };
    });
}

function topicOptionsToText(options?: FormFieldOption[]) {
  return (options?.length ? options : DEFAULT_TOPIC_OPTIONS)
    .map((option) => option.label)
    .join("\n");
}

function textToTopicOptions(value: string): FormFieldOption[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => ({
      value: slugify(label),
      label,
    }));
}

function slugify(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: 16,
};

const fieldStyle: CSSProperties = {
  border: "1px solid #e6ebf1",
  background: "#fbfcfe",
  borderRadius: 8,
  padding: 12,
};

const labelGridStyle: CSSProperties = {
  display: "grid",
  gap: 5,
};

const labelStyle: CSSProperties = {
  color: "#5a6573",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #dde3ea",
  borderRadius: 7,
  padding: "8px 9px",
  fontSize: 13,
  background: "#fff",
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 8,
  padding: "11px 13px",
  background: "#16324f",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #2f6f6a",
  borderRadius: 8,
  padding: "10px 13px",
  background: "#fff",
  color: "#2f6f6a",
  fontWeight: 700,
  fontSize: 13,
};

const smallButtonStyle: CSSProperties = {
  border: "1px solid #dde3ea",
  borderRadius: 7,
  padding: "6px 8px",
  background: "#fff",
  color: "#394554",
  fontWeight: 700,
  fontSize: 12,
};

const smallDangerButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  border: "1px solid #f1b5ae",
  color: "#b3261e",
  background: "#fff7f6",
};
