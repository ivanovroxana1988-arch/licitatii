import type { Factor } from "@/lib/scoring";

export const DOCUMENT_TYPES = ["recomandare", "contract", "diploma", "certificat", "altul"] as const;
export type DocumentTip = (typeof DOCUMENT_TYPES)[number];
export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "contract_list" | "document_upload";
export type FieldSource = "standard" | "dynamic";
export type FormFieldOption = { value: string; label: string; points?: number };
export type FormFieldScoring = { factorCod?: string; mode?: "value" | "select_map" | "checkbox" };
export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  source?: FieldSource;
  bind?: string;
  help?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: FormFieldOption[];
  optionsSource?: "study_domains";
  scoring?: FormFieldScoring;
  requiredDocumentTypes?: DocumentTip[];
};
export type FormSection = { id: string; title: string; description?: string; fields: FormField[] };
export type FormularConfig = { version: 1; sections: FormSection[] };
export type AplicareContract = { id?: string; organizatie: string; domeniu_org?: string | null; structura_complexa: boolean; perioada?: string | null; ore: number; tematici?: string | null; nr_tematici?: number; ordine?: number };
export type AplicareDocument = { id: string; formator_id: string; contract_id?: string | null; tip: DocumentTip; nume_fisier: string; storage_path: string; marime?: number | null; incarcat_la?: string };
export type AplicareFormator = { id?: string; nume?: string | null; prenume?: string | null; email?: string | null; telefon?: string | null; domeniu_studii?: string | null; studii_detalii?: string | null; are_cor_242401?: boolean | null; ani_management?: number | null; bio?: string | null };
export type DynamicAnswers = Record<string, unknown>;

export const defaultFormularConfig: FormularConfig = {
  version: 1,
  sections: [
    { id: "date-identificare", title: "Date de identificare", fields: [
      { id: "nume", label: "Nume", type: "text", source: "standard", bind: "nume", required: true },
      { id: "prenume", label: "Prenume", type: "text", source: "standard", bind: "prenume", required: true },
      { id: "email", label: "Email", type: "text", source: "standard", bind: "email", required: true },
      { id: "telefon", label: "Telefon", type: "text", source: "standard", bind: "telefon" },
      { id: "domeniu_studii", label: "Domeniu studii", type: "select", source: "standard", bind: "domeniu_studii", optionsSource: "study_domains", required: true, scoring: { factorCod: "F2.1", mode: "select_map" } },
      { id: "studii_detalii", label: "Detalii studii", type: "textarea", source: "standard", bind: "studii_detalii" },
      { id: "are_cor_242401", label: "Detin certificat Formator COR 242401", type: "checkbox", source: "standard", bind: "are_cor_242401", required: true },
      { id: "ani_management", label: "Ani experienta management", type: "number", source: "standard", bind: "ani_management", min: 0 },
      { id: "bio", label: "Profil profesional scurt", type: "textarea", source: "standard", bind: "bio" },
    ] },
    { id: "contracte", title: "Contracte si experienta", fields: [{ id: "contracte", label: "Contracte", type: "contract_list", required: true }] },
    { id: "documente", title: "Documente justificative", fields: [{ id: "documente", label: "Documente", type: "document_upload", requiredDocumentTypes: ["recomandare", "contract", "diploma", "certificat"] }] },
  ],
};

export function normalizeFormularConfig(value: unknown): FormularConfig {
  const v = value as Partial<FormularConfig> | null;
  if (!v || !Array.isArray(v.sections)) return defaultFormularConfig;
  return { version: 1, sections: v.sections.map((s, i) => ({ id: cleanId(s.id, `sectiune-${i + 1}`), title: textOr(s.title, `Sectiune ${i + 1}`), description: str(s.description), fields: Array.isArray(s.fields) ? s.fields.map((f, j) => normalizeField(f, j)) : [] })) };
}

export function getStudyDomainOptions(factors: Factor[]): FormFieldOption[] {
  const factor = factors.find((f) => f.cod === "F2.1" && f.tip === "domain_map") ?? factors.find((f) => f.tip === "domain_map");
  return factor?.config_json.map?.map((item) => ({ value: item.key, label: item.label, points: item.pts })) ?? [];
}

export function countTopics(value?: string | null): number {
  return value?.trim() ? value.split(",").map((x) => x.trim()).filter(Boolean).length : 0;
}

export function validateRequiredForm(params: { config: FormularConfig; formator: AplicareFormator; contracte: AplicareContract[]; answers: DynamicAnswers; documente: AplicareDocument[] }): string[] {
  const errors: string[] = [];
  for (const section of params.config.sections) for (const field of section.fields) {
    if (field.type === "contract_list" && field.required && params.contracte.length === 0) errors.push("Adauga cel putin un contract relevant.");
    else if (field.type === "document_upload") for (const tip of field.requiredDocumentTypes ?? []) if (!params.documente.some((d) => d.tip === tip)) errors.push(`Incarca cel putin un document de tip ${documentTypeLabel(tip)}.`);
    else if (field.required) {
      const value = field.source === "dynamic" ? params.answers[field.id] : params.formator[field.bind as keyof AplicareFormator];
      if (empty(value)) errors.push(`Completeaza campul "${field.label}".`);
    }
  }
  return errors;
}

export function documentTypeLabel(tip: DocumentTip): string {
  return { recomandare: "Recomandare", contract: "Contract", diploma: "Diploma", certificat: "Certificat", altul: "Alt document" }[tip];
}

function normalizeField(f: FormField, i: number): FormField {
  return { ...f, id: cleanId(f.id, `camp-${i + 1}`), label: textOr(f.label, `Camp ${i + 1}`), type: isFieldType(f.type) ? f.type : "text", help: str(f.help), required: !!f.required };
}
function isFieldType(v: unknown): v is FieldType { return ["text", "textarea", "number", "date", "select", "checkbox", "contract_list", "document_upload"].includes(String(v)); }
function empty(v: unknown) { return v === null || v === undefined || v === false || (typeof v === "string" && v.trim() === ""); }
function cleanId(v: unknown, fallback: string) { return typeof v === "string" && v.trim() ? v.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) : fallback; }
function textOr(v: unknown, fallback: string) { return typeof v === "string" && v.trim() ? v.trim() : fallback; }
function str(v: unknown) { return typeof v === "string" && v.trim() ? v.trim() : undefined; }
