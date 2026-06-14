import type { Factor } from "@/lib/scoring";

export const DOCUMENT_TYPES = [
  "recomandare",
  "contract",
  "diploma",
  "certificat",
  "altul",
] as const;

export type DocumentTip = (typeof DOCUMENT_TYPES)[number];

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "contract_list"
  | "document_upload";

export type FieldSource = "standard" | "dynamic";

export type FormFieldOption = {
  value: string;
  label: string;
  points?: number;
};

export type FormFieldScoring = {
  factorCod?: string;
  mode?: "value" | "select_map" | "checkbox";
};

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
  topicOptions?: FormFieldOption[];
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormularConfig = {
  version: 1;
  sections: FormSection[];
};

export type AplicareContract = {
  id?: string;
  organizatie: string;
  domeniu_org?: string | null;
  structura_complexa: boolean;
  perioada?: string | null;
  ore: number;
  tematici?: string | null;
  nr_tematici?: number;
  ordine?: number;
};

export type AplicareDocument = {
  id: string;
  formator_id: string;
  contract_id?: string | null;
  tip: DocumentTip;
  nume_fisier: string;
  storage_path: string;
  marime?: number | null;
  incarcat_la?: string;
};

export type AplicareFormator = {
  id?: string;
  nume?: string | null;
  prenume?: string | null;
  email?: string | null;
  telefon?: string | null;
  domeniu_studii?: string | null;
  studii_detalii?: string | null;
  are_cor_242401?: boolean | null;
  ani_management?: number | null;
  bio?: string | null;
};

export type DynamicAnswers = Record<string, unknown>;

export const DEFAULT_TOPIC_OPTIONS: FormFieldOption[] = [
  { value: "management-effectiveness", label: "Management Effectiveness" },
  { value: "teamwork", label: "Teamwork" },
  { value: "inteligenta-emotionala", label: "Inteligenta emotionala" },
  { value: "self-awareness", label: "Self-awareness" },
  { value: "self-correction", label: "Self-Correction" },
  { value: "comunicare", label: "Comunicare" },
  { value: "public-speaking", label: "Public Speaking" },
  { value: "coaching", label: "Coaching" },
];

export const defaultFormularConfig: FormularConfig = {
  version: 1,
  sections: [
    {
      id: "date-identificare",
      title: "Date de identificare",
      description: "Datele care vor aparea in CV si in declaratiile generate.",
      fields: [
        { id: "nume", label: "Nume", type: "text", source: "standard", bind: "nume", required: true },
        { id: "prenume", label: "Prenume", type: "text", source: "standard", bind: "prenume", required: true },
        { id: "email", label: "Email", type: "text", source: "standard", bind: "email", required: true },
        { id: "telefon", label: "Telefon", type: "text", source: "standard", bind: "telefon" },
        {
          id: "domeniu_studii",
          label: "Domeniu studii",
          type: "select",
          source: "standard",
          bind: "domeniu_studii",
          optionsSource: "study_domains",
          required: true,
          scoring: { factorCod: "F2.1", mode: "select_map" },
        },
        {
          id: "studii_detalii",
          label: "Detalii studii",
          type: "textarea",
          source: "standard",
          bind: "studii_detalii",
          help: "Diplome, programe, institutii si ani relevanti.",
        },
        {
          id: "are_cor_242401",
          label: "Detin certificat Formator COR 242401",
          type: "checkbox",
          source: "standard",
          bind: "are_cor_242401",
          required: true,
        },
        {
          id: "ani_management",
          label: "Ani experienta management",
          type: "number",
          source: "standard",
          bind: "ani_management",
          min: 0,
        },
        {
          id: "bio",
          label: "Profil profesional scurt",
          type: "textarea",
          source: "standard",
          bind: "bio",
        },
      ],
    },
    {
      id: "contracte",
      title: "Contracte si experienta",
      description: "Un rand pentru fiecare contract relevant.",
      fields: [
        {
          id: "contracte",
          label: "Contracte",
          type: "contract_list",
          required: true,
          topicOptions: DEFAULT_TOPIC_OPTIONS,
        },
      ],
    },
    {
      id: "documente",
      title: "Documente justificative",
      description: "Incarca documentele care sustin experienta, studiile si certificarile.",
      fields: [
        {
          id: "documente",
          label: "Documente",
          type: "document_upload",
          requiredDocumentTypes: ["recomandare", "contract", "diploma", "certificat"],
        },
      ],
    },
  ],
};

export function normalizeFormularConfig(value: unknown): FormularConfig {
  if (!value || typeof value !== "object") return defaultFormularConfig;
  const maybe = value as Partial<FormularConfig>;
  if (!Array.isArray(maybe.sections)) return defaultFormularConfig;

  return {
    version: 1,
    sections: maybe.sections.map((section, sectionIndex) => ({
      id: cleanId(section.id, `sectiune-${sectionIndex + 1}`),
      title: textOr(section.title, `Sectiune ${sectionIndex + 1}`),
      description: stringOrEmpty(section.description),
      fields: Array.isArray(section.fields)
        ? section.fields.map((field, fieldIndex) => normalizeField(field, fieldIndex))
        : [],
    })),
  };
}

export function getStudyDomainOptions(factors: Factor[]): FormFieldOption[] {
  const domainFactor =
    factors.find((factor) => factor.cod === "F2.1" && factor.tip === "domain_map") ??
    factors.find((factor) => factor.tip === "domain_map");

  return (
    domainFactor?.config_json.map?.map((item) => ({
      value: item.key,
      label: item.label,
      points: item.pts,
    })) ?? []
  );
}

export function countTopics(value?: string | null): number {
  if (!value?.trim()) return 0;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean).length;
}

export function validateRequiredForm(params: {
  config: FormularConfig;
  formator: AplicareFormator;
  contracte: AplicareContract[];
  answers: DynamicAnswers;
  documente: AplicareDocument[];
}): string[] {
  const errors: string[] = [];
  for (const section of params.config.sections) {
    for (const field of section.fields) {
      if (
        field.type === "contract_list" &&
        field.required &&
        !params.contracte.some(contractHasContent)
      ) {
        errors.push("Adauga cel putin un contract relevant.");
        continue;
      }

      if (field.type === "document_upload") {
        for (const tip of field.requiredDocumentTypes ?? []) {
          if (!params.documente.some((doc) => doc.tip === tip)) {
            errors.push(`Incarca cel putin un document de tip ${documentTypeLabel(tip)}.`);
          }
        }
        continue;
      }

      if (!field.required) continue;
      const value =
        field.source === "dynamic"
          ? params.answers[field.id]
          : params.formator[field.bind as keyof AplicareFormator];

      if (isEmpty(value)) {
        errors.push(`Completeaza campul "${field.label}".`);
      }
    }
  }
  return errors;
}

export function documentTypeLabel(tip: DocumentTip): string {
  const labels: Record<DocumentTip, string> = {
    recomandare: "Recomandare",
    contract: "Contract",
    diploma: "Diploma",
    certificat: "Certificat",
    altul: "Alt document",
  };
  return labels[tip];
}

function normalizeField(field: FormField, fieldIndex: number): FormField {
  const type = isFieldType(field.type) ? field.type : "text";
  return {
    id: cleanId(field.id, `camp-${fieldIndex + 1}`),
    label: textOr(field.label, `Camp ${fieldIndex + 1}`),
    type,
    source: field.source === "standard" ? "standard" : field.source === "dynamic" ? "dynamic" : undefined,
    bind: typeof field.bind === "string" ? field.bind : undefined,
    help: stringOrEmpty(field.help),
    required: !!field.required,
    min: numberOrUndefined(field.min),
    max: numberOrUndefined(field.max),
    options: Array.isArray(field.options)
      ? field.options.map((option) => ({
          value: textOr(option.value, option.label),
          label: textOr(option.label, option.value),
          points: numberOrUndefined(option.points),
        }))
      : undefined,
    optionsSource: field.optionsSource === "study_domains" ? "study_domains" : undefined,
    scoring: field.scoring,
    requiredDocumentTypes: Array.isArray(field.requiredDocumentTypes)
      ? field.requiredDocumentTypes.filter((tip): tip is DocumentTip =>
          DOCUMENT_TYPES.includes(tip as DocumentTip)
        )
      : undefined,
    topicOptions: Array.isArray(field.topicOptions)
      ? field.topicOptions
          .map((option) => ({
            value: cleanId(option.value, option.label),
            label: textOr(option.label, option.value),
            points: numberOrUndefined(option.points),
          }))
          .filter((option) => option.value && option.label)
      : undefined,
  };
}

function contractHasContent(contract: AplicareContract): boolean {
  return !!(
    contract.organizatie?.trim() ||
    contract.domeniu_org?.trim() ||
    contract.perioada?.trim() ||
    contract.tematici?.trim() ||
    Number(contract.ore) > 0
  );
}

function isFieldType(value: unknown): value is FieldType {
  return (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "date" ||
    value === "select" ||
    value === "checkbox" ||
    value === "contract_list" ||
    value === "document_upload"
  );
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return value === false;
  if (typeof value === "number") return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function cleanId(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringOrEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
