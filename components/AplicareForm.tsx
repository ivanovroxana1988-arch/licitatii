"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AplicarePayload } from "@/lib/aplicare";
import {
  DOCUMENT_TYPES,
  DEFAULT_TOPIC_OPTIONS,
  countTopics,
  documentTypeLabel,
  getStudyDomainOptions,
  validateRequiredForm,
  type AplicareContract,
  type AplicareFormator,
  type DocumentTip,
  type DynamicAnswers,
  type FormField,
  type FormFieldOption,
} from "@/lib/form-schema";
import { isEligible, type Formator } from "@/lib/scoring";

type Props = { token: string };

export default function AplicareForm({ token }: Props) {
  const [payload, setPayload] = useState<AplicarePayload | null>(null);
  const [formator, setFormator] = useState<AplicareFormator>({});
  const [contracte, setContracte] = useState<AplicareContract[]>([]);
  const [answers, setAnswers] = useState<DynamicAnswers>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadTip, setUploadTip] = useState<DocumentTip>("recomandare");
  const [uploadContractId, setUploadContractId] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/aplicare/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca aplicarea.");
        return data as AplicarePayload;
      })
      .then((data) => {
        if (!active) return;
        applyPayload(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Nu am putut incarca aplicarea.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const readonly = !!payload?.aplicare.readonly;
  const config = payload?.licitatie.formular_config_json;
  const studyOptions = useMemo(
    () => getStudyDomainOptions(payload?.factori ?? []),
    [payload?.factori]
  );

  const eligibility = useMemo(() => {
    if (!payload) return null;
    const scoringFormator: Formator = {
      id: payload.formator.id ?? "draft",
      nume: formator.nume ?? "",
      prenume: formator.prenume ?? "",
      domeniu_studii: formator.domeniu_studii ?? "",
      are_cor_242401: !!formator.are_cor_242401,
      raspunsuri_formular_json: answers,
      contracte: contracte.map((contract) => ({
        organizatie: contract.organizatie,
        structura_complexa: !!contract.structura_complexa,
        ore: Number(contract.ore) || 0,
        nr_tematici: countTopics(contract.tematici),
      })),
    };
    return isEligible(scoringFormator, payload.criterii, payload.factori);
  }, [answers, contracte, formator, payload]);

  function applyPayload(next: AplicarePayload | null) {
    if (!next) return;
    setPayload(next);
    setFormator(next.formator);
    setContracte(next.contracte.length ? next.contracte : [emptyContract()]);
    setAnswers(next.aplicare.raspunsuri_formular_json ?? {});
  }

  async function save(): Promise<AplicarePayload | null> {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/aplicare/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formator,
          contracte,
          raspunsuri_formular_json: answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva formularul.");
      applyPayload(data as AplicarePayload);
      setSuccess("Datele au fost salvate.");
      return data as AplicarePayload;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva formularul.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!payload?.aplicare.formator_id) {
        const saved = await save();
        if (!saved?.aplicare.formator_id) throw new Error("Salveaza datele inainte de upload.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("tip", uploadTip);
      if (uploadContractId) formData.append("contract_id", uploadContractId);

      const res = await fetch(`/api/aplicare/${token}/documente`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nu am putut incarca documentul.");
      applyPayload(data as AplicarePayload);
      setSuccess("Documentul a fost incarcat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut incarca documentul.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(documentId: string) {
    if (!window.confirm("Stergi acest document?")) return;
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/aplicare/${token}/documente/${documentId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Nu am putut sterge documentul.");
      return;
    }
    applyPayload(data as AplicarePayload);
    setSuccess("Documentul a fost sters.");
  }

  async function finalizeApplication() {
    if (!payload || !config) return;
    setError(null);
    setSuccess(null);

    const localErrors = validateRequiredForm({
      config,
      formator,
      contracte,
      answers,
      documente: payload.documente,
    });
    if (localErrors.length) {
      setError(localErrors.join(" "));
      return;
    }

    if (!window.confirm("Dupa finalizare, formularul devine doar pentru citire. Continui?")) return;

    setFinalizing(true);
    try {
      const saved = await save();
      if (!saved) return;
      const res = await fetch(`/api/aplicare/${token}/finalizare`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        const details = Array.isArray(data.details) ? ` ${data.details.join(" ")}` : "";
        throw new Error((data.error ?? "Nu am putut finaliza aplicarea.") + details);
      }
      applyPayload(data as AplicarePayload);
      setSuccess("Aplicarea a fost finalizata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut finaliza aplicarea.");
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return <Shell title="Se incarca aplicarea">Verificam linkul si incarcam formularul.</Shell>;
  }

  if (error && !payload) {
    return (
      <Shell title="Link invalid">
        <p style={mutedText}>{error}</p>
      </Shell>
    );
  }

  if (!payload || !config) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={headerStyle}>
        <div>
          <div style={kickerStyle}>FORMULAR FORMATOR</div>
          <h1 style={{ fontSize: 22, marginTop: 4 }}>{payload.licitatie.nume}</h1>
          <p style={{ fontSize: 13, opacity: 0.82, marginTop: 4 }}>
            {payload.licitatie.referinta} {payload.licitatie.beneficiar ? `- ${payload.licitatie.beneficiar}` : ""}
          </p>
        </div>
        <StatusBadge status={payload.aplicare.status} />
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <div style={{ display: "grid", gap: 16 }}>
            {config.sections.map((section) => (
              <section key={section.id} style={sectionStyle}>
                <div style={{ marginBottom: 14 }}>
                  <h2 style={{ fontSize: 16, color: "#16324f" }}>{section.title}</h2>
                  {section.description && <p style={mutedText}>{section.description}</p>}
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {section.fields.map((field) => renderField(field, readonly, studyOptions))}
                </div>
              </section>
            ))}
          </div>

          <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div style={panelStyle}>
              <h2 style={{ fontSize: 15, color: "#16324f", marginBottom: 10 }}>Eligibilitate</h2>
              {eligibility ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: eligibility.ok ? "#e6f4ec" : "#fff3e0",
                      color: eligibility.ok ? "#2e7d52" : "#8a5a00",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {eligibility.ok ? "Criterii indeplinite" : "Mai sunt criterii neindeplinite"}
                  </div>
                  {eligibility.details.map((detail) => (
                    <div key={detail.eticheta} style={{ fontSize: 13, color: "#394554" }}>
                      <span style={{ color: detail.ok ? "#2e7d52" : "#b3261e", fontWeight: 700 }}>
                        {detail.ok ? "OK" : "X"}
                      </span>{" "}
                      {detail.eticheta}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={mutedText}>Eligibilitatea apare dupa incarcarea datelor.</p>
              )}
            </div>

            {error && <Message tone="error">{error}</Message>}
            {success && <Message tone="success">{success}</Message>}

            <div style={panelStyle}>
              <button type="button" disabled={readonly || saving} onClick={save} style={primaryButtonStyle}>
                {saving ? "Se salveaza..." : "Salveaza"}
              </button>
              <button
                type="button"
                disabled={readonly || finalizing}
                onClick={finalizeApplication}
                style={{ ...secondaryButtonStyle, marginTop: 10 }}
              >
                {finalizing ? "Se finalizeaza..." : "Finalizeaza aplicarea"}
              </button>
              {readonly && (
                <p style={{ ...mutedText, marginTop: 10 }}>
                  Aplicarea a fost finalizata si este disponibila doar pentru citire.
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );

  function renderField(field: FormField, disabled: boolean, studyDomainOptions: ReturnType<typeof getStudyDomainOptions>) {
    if (field.type === "contract_list") return renderContractList(field, disabled);
    if (field.type === "document_upload") return renderDocumentUpload(field, disabled);

    const value = getFieldValue(field);
    const options = field.optionsSource === "study_domains" ? studyDomainOptions : field.options ?? [];
    const commonProps = {
      id: field.id,
      disabled,
      style: inputStyle,
    };

    return (
      <label key={field.id} style={{ display: "grid", gap: 5 }}>
        <span style={labelStyle}>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        {field.type === "textarea" ? (
          <textarea
            {...commonProps}
            rows={4}
            value={String(value ?? "")}
            onChange={(event) => setFieldValue(field, event.target.value)}
          />
        ) : field.type === "select" ? (
          <select
            {...commonProps}
            value={String(value ?? "")}
            onChange={(event) => setFieldValue(field, event.target.value)}
          >
            <option value="">Alege o optiune</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === "checkbox" ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={!!value}
              onChange={(event) => setFieldValue(field, event.target.checked)}
            />
            Da
          </span>
        ) : (
          <input
            {...commonProps}
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            min={field.min}
            max={field.max}
            value={String(value ?? "")}
            onChange={(event) =>
              setFieldValue(field, field.type === "number" ? Number(event.target.value) : event.target.value)
            }
          />
        )}
        {field.help && <span style={{ fontSize: 12, color: "#6b7480" }}>{field.help}</span>}
      </label>
    );
  }

  function renderContractList(field: FormField, disabled: boolean) {
    const topicOptions = field.topicOptions?.length ? field.topicOptions : DEFAULT_TOPIC_OPTIONS;

    return (
      <div key={field.id} style={{ display: "grid", gap: 10 }}>
        {contracte.map((contract, index) => (
          <div key={contract.id ?? index} style={contractCardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <Input
                label="Organizatie"
                value={contract.organizatie}
                disabled={disabled}
                onChange={(value) => updateContract(index, { organizatie: value })}
              />
              <Input
                label="Domeniu organizatie"
                value={contract.domeniu_org ?? ""}
                disabled={disabled}
                onChange={(value) => updateContract(index, { domeniu_org: value })}
              />
              <PeriodInput
                value={contract.perioada ?? ""}
                disabled={disabled}
                onChange={(value) => updateContract(index, { perioada: value })}
              />
              <Input
                label="Ore"
                type="number"
                value={String(contract.ore ?? 0)}
                disabled={disabled}
                onChange={(value) => updateContract(index, { ore: Number(value) || 0 })}
              />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 13 }}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!contract.structura_complexa}
                onChange={(event) => updateContract(index, { structura_complexa: event.target.checked })}
              />
              Organizatie/structura complexa
            </label>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <span style={labelStyle}>Tematici predefinite</span>
              <div style={topicGridStyle}>
                {topicOptions.map((option) => (
                  <label key={option.value} style={topicOptionStyle}>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={isTopicSelected(contract.tematici, option)}
                      onChange={(event) =>
                        updateContract(index, {
                          tematici: toggleTopic(contract.tematici, option, event.target.checked, topicOptions),
                        })
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <span style={{ fontSize: 12, color: "#6b7480" }}>
                Tematici bifate: {countTopics(contract.tematici)}
              </span>
            </div>
            {!disabled && (
              <button type="button" onClick={() => removeContract(index)} style={smallDangerButtonStyle}>
                Sterge contract
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" onClick={() => setContracte((items) => [...items, emptyContract()])} style={secondaryButtonStyle}>
            Adauga contract
          </button>
        )}
      </div>
    );
  }

  function renderDocumentUpload(field: FormField, disabled: boolean) {
    const currentPayload = payload;
    if (!currentPayload) return null;

    return (
      <div key={field.id} style={{ display: "grid", gap: 12 }}>
        {!disabled && (
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={labelStyle}>Tip document</span>
              <select value={uploadTip} onChange={(event) => setUploadTip(event.target.value as DocumentTip)} style={inputStyle}>
                {DOCUMENT_TYPES.map((tip) => (
                  <option key={tip} value={tip}>
                    {documentTypeLabel(tip)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={labelStyle}>Ataseaza la contract (optional)</span>
              <select value={uploadContractId} onChange={(event) => setUploadContractId(event.target.value)} style={inputStyle}>
                <option value="">Fara contract anume</option>
                {currentPayload.contracte.map((contract, index) => (
                  <option key={contract.id ?? index} value={contract.id ?? ""}>
                    {contract.organizatie}
                  </option>
                ))}
              </select>
            </label>
            <input
              disabled={uploading}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => uploadFile(event.target.files?.[0] ?? null)}
              style={{ ...inputStyle, gridColumn: "1 / -1" }}
            />
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {currentPayload.documente.length === 0 && <p style={mutedText}>Nu exista documente incarcate.</p>}
          {currentPayload.documente.map((doc) => (
            <div key={doc.id} style={documentRowStyle}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.nume_fisier}</div>
                <div style={{ fontSize: 12, color: "#6b7480" }}>
                  {documentTypeLabel(doc.tip)} - {formatBytes(doc.marime ?? 0)}
                </div>
              </div>
              {!disabled && (
                <button type="button" onClick={() => deleteDocument(doc.id)} style={smallDangerButtonStyle}>
                  Sterge
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function getFieldValue(field: FormField): unknown {
    if (field.source === "dynamic") return answers[field.id];
    if (!field.bind) return "";
    return formator[field.bind as keyof AplicareFormator] ?? "";
  }

  function setFieldValue(field: FormField, value: unknown) {
    if (field.source === "dynamic") {
      setAnswers((current) => ({ ...current, [field.id]: value }));
      return;
    }
    if (!field.bind) return;
    setFormator((current) => ({ ...current, [field.bind as keyof AplicareFormator]: value }));
  }

  function updateContract(index: number, patch: Partial<AplicareContract>) {
    setContracte((items) => items.map((item, current) => (current === index ? { ...item, ...patch } : item)));
  }

  function removeContract(index: number) {
    setContracte((items) => (items.length === 1 ? [emptyContract()] : items.filter((_, current) => current !== index)));
  }
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={panelStyle}>
        <div style={kickerStyle}>FORMULAR FORMATOR</div>
        <h1 style={{ color: "#16324f", fontSize: 22, marginTop: 6 }}>{title}</h1>
        <div style={{ marginTop: 10 }}>{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "finalizat" ? "Finalizat" : status === "in_completare" ? "In completare" : "Invitat";
  return (
    <span
      style={{
        alignSelf: "start",
        fontSize: 12,
        fontWeight: 700,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.24)",
      }}
    >
      {label}
    </span>
  );
}

function PeriodInput(props: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const period = parsePeriod(props.value);
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={labelStyle}>Perioada</span>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(90px, 1fr) minmax(120px, 1fr)", gap: 8 }}>
        <input
          type="number"
          min={0}
          step={1}
          disabled={props.disabled}
          value={period.amount}
          onChange={(event) => props.onChange(formatPeriod(event.target.value, period.unit))}
          style={inputStyle}
          placeholder="Numar"
        />
        <select
          disabled={props.disabled}
          value={period.unit}
          onChange={(event) => props.onChange(formatPeriod(period.amount, event.target.value))}
          style={inputStyle}
        >
          {PERIOD_UNITS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function Input(props: {
  label: string;
  value: string;
  type?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={labelStyle}>{props.label}</span>
      <input
        type={props.type ?? "text"}
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function parsePeriod(value: string): { amount: string; unit: string } {
  const fallback = PERIOD_UNITS[0].value;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s+([a-zA-Z-]+)$/);
  if (!match) return { amount: "", unit: fallback };
  const unit = PERIOD_UNITS.some((item) => item.value === match[2]) ? match[2] : fallback;
  return { amount: match[1].replace(",", "."), unit };
}

function formatPeriod(amount: string, unit: string): string {
  const cleanAmount = amount.replace(",", ".").trim();
  if (!cleanAmount) return "";
  const cleanUnit = PERIOD_UNITS.some((item) => item.value === unit) ? unit : PERIOD_UNITS[0].value;
  return `${cleanAmount} ${cleanUnit}`;
}

function isTopicSelected(value: string | null | undefined, option: FormFieldOption): boolean {
  const topics = topicParts(value).map(normalizeTopic);
  return topics.includes(normalizeTopic(option.label)) || topics.includes(normalizeTopic(option.value));
}

function toggleTopic(
  current: string | null | undefined,
  option: FormFieldOption,
  checked: boolean,
  options: FormFieldOption[]
): string {
  const selected = new Set(
    options.filter((item) => isTopicSelected(current, item)).map((item) => item.value)
  );
  if (checked) selected.add(option.value);
  else selected.delete(option.value);
  return options
    .filter((item) => selected.has(item.value))
    .map((item) => item.label)
    .join(", ");
}

function topicParts(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTopic(value: string): string {
  return value.trim().toLowerCase();
}

function Message({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${tone === "error" ? "#f1b5ae" : "#b9dbc7"}`,
        color: tone === "error" ? "#b3261e" : "#1a7f37",
        background: tone === "error" ? "#fff7f6" : "#f1faf4",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}

function emptyContract(): AplicareContract {
  return {
    organizatie: "",
    domeniu_org: "",
    structura_complexa: false,
    perioada: "",
    ore: 0,
    tematici: "",
    nr_tematici: 0,
  };
}

function formatBytes(value: number) {
  if (!value) return "marime necunoscuta";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
}

const PERIOD_UNITS = [
  { value: "ani", label: "Ani" },
  { value: "luni", label: "Luni" },
  { value: "saptamani", label: "Saptamani" },
  { value: "zile", label: "Zile" },
  { value: "sesiuni", label: "Sesiuni" },
  { value: "ore", label: "Ore" },
] as const;

const headerStyle: CSSProperties = {
  background: "#16324f",
  color: "#fff",
  padding: "18px 20px",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
};

const kickerStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  opacity: 0.72,
  letterSpacing: ".08em",
};

const sectionStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: 18,
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: 16,
};

const contractCardStyle: CSSProperties = {
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: 12,
  background: "#fbfcfe",
};

const documentRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  border: "1px solid #dde3ea",
  borderRadius: 8,
  padding: "10px 12px",
};

const topicGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 8,
};

const topicOptionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #dde3ea",
  borderRadius: 7,
  padding: "8px 9px",
  background: "#fff",
  fontSize: 13,
  color: "#394554",
};

const mutedText: CSSProperties = {
  color: "#5a6573",
  fontSize: 13,
  lineHeight: 1.45,
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
  padding: "9px 10px",
  fontSize: 14,
  background: "#fff",
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 8,
  padding: "11px 14px",
  background: "#16324f",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #2f6f6a",
  borderRadius: 8,
  padding: "10px 13px",
  background: "#fff",
  color: "#2f6f6a",
  fontSize: 13,
  fontWeight: 700,
};

const smallDangerButtonStyle: CSSProperties = {
  border: "1px solid #f1b5ae",
  borderRadius: 7,
  padding: "7px 9px",
  background: "#fff7f6",
  color: "#b3261e",
  fontSize: 12,
  fontWeight: 700,
  marginTop: 10,
};
