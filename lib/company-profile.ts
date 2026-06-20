import type { FormularConfig } from "@/lib/form-schema";
import type { TenderWorkspace } from "@/lib/tender-workspace";

export type CompanyProfile = {
  id?: string;
  denumire?: string | null;
  cui?: string | null;
  nr_reg_com?: string | null;
  sediu?: string | null;
  localitate?: string | null;
  judet?: string | null;
  iban?: string | null;
  banca?: string | null;
  reprezentant_nume?: string | null;
  reprezentant_functie?: string | null;
  email?: string | null;
  telefon?: string | null;
  website?: string | null;
  caen_principal?: string | null;
  caen_secundare?: string | null;
  descriere?: string | null;
  experienta_similara?: string | null;
  declaratii_json?: Record<string, unknown> | null;
  documente_json?: Record<string, unknown> | null;
};

export type CompanyDocument = {
  id?: string;
  tip: string;
  titlu: string;
  nume_fisier: string;
  storage_bucket?: string | null;
  storage_path?: string | null;
  text_extras?: string | null;
  metadate_json?: Record<string, unknown> | null;
};

export type CompanyAutofillResult = {
  values: Record<string, unknown>;
  missing: string[];
  suggestions: string[];
};

export const COMPANY_DOCUMENT_TYPES = [
  { value: "certificat_constatator", label: "Certificat constatator ONRC" },
  { value: "certificat_fiscal", label: "Certificat fiscal" },
  { value: "certificat_beneficiar_real", label: "Dovada beneficiar real" },
  { value: "imputernicire", label: "Imputernicire semnatar" },
  { value: "contract_similar", label: "Contract similar" },
  { value: "recomandare", label: "Recomandare" },
  { value: "altul", label: "Alt document" },
] as const;

const PROFILE_KEY_MAP: Record<string, keyof CompanyProfile> = {
  denumire: "denumire",
  nume_operator: "denumire",
  operator_economic: "denumire",
  ofertant: "denumire",
  cui: "cui",
  cod_fiscal: "cui",
  cod_unic: "cui",
  nr_reg_com: "nr_reg_com",
  registrul_comertului: "nr_reg_com",
  sediu: "sediu",
  adresa: "sediu",
  sediu_social: "sediu",
  localitate: "localitate",
  judet: "judet",
  iban: "iban",
  cont: "iban",
  banca: "banca",
  reprezentant: "reprezentant_nume",
  reprezentant_legal: "reprezentant_nume",
  reprezentant_nume: "reprezentant_nume",
  functie_reprezentant: "reprezentant_functie",
  reprezentant_functie: "reprezentant_functie",
  email: "email",
  telefon: "telefon",
  website: "website",
  caen: "caen_principal",
  caen_principal: "caen_principal",
  caen_secundare: "caen_secundare",
  descriere: "descriere",
  experienta_similara: "experienta_similara",
};

const DECLARATION_DEFAULTS: Record<string, boolean> = {
  declaratie_neincadrare_164: true,
  declaratie_neincadrare_165: true,
  declaratie_neincadrare_167: true,
  declaratie_conflict_interese: true,
  declaratie_beneficiar_real: true,
  declaratie_mediu_munca: true,
  declaratie_gdpr: true,
};

export function buildCompanyAutofill(params: {
  profile: CompanyProfile | null | undefined;
  documents?: CompanyDocument[];
  formularConfig?: FormularConfig | null;
  workspace?: TenderWorkspace | null;
}): CompanyAutofillResult {
  const profile = params.profile ?? {};
  const documents = params.documents ?? [];
  const values: Record<string, unknown> = {};
  const missing = new Set<string>();
  const suggestions = new Set<string>();

  const profileMissing = requiredCompanyProfileFields(profile);
  profileMissing.forEach((item) => missing.add(item));

  const baseValues = companyProfileToFlatValues(profile);
  Object.assign(values, baseValues);

  for (const [key, fallback] of Object.entries(DECLARATION_DEFAULTS)) {
    const explicit = profile.declaratii_json?.[key];
    values[key] = typeof explicit === "boolean" ? explicit : fallback;
  }

  const fields = params.formularConfig?.sections.flatMap((section) => section.fields) ?? [];
  for (const field of fields) {
    const matchKey = matchFieldToProfileKey(field.id, field.label);
    if (matchKey) {
      const value = profile[matchKey];
      if (hasValue(value)) values[field.id] = value;
      else if (field.required) missing.add(`Lipseste ${field.label} in profilul companiei.`);
    }
  }

  for (const document of documents) {
    values[`document_${document.tip}`] = document.nume_fisier;
  }

  if (params.workspace) {
    const docs = params.workspace.dossier.administrativeDocuments;
    for (const doc of docs) {
      const lower = normalize(doc);
      if (lower.includes("onrc") || lower.includes("constatator")) {
        if (!hasCompanyDocument(documents, "certificat_constatator")) missing.add("Incarca certificatul constatator ONRC in profilul companiei.");
      }
      if (lower.includes("fiscal")) {
        if (!hasCompanyDocument(documents, "certificat_fiscal")) missing.add("Incarca certificatul fiscal in profilul companiei.");
      }
      if (lower.includes("beneficiar real")) {
        values.declaratie_beneficiar_real = true;
        if (!hasCompanyDocument(documents, "certificat_beneficiar_real")) missing.add("Incarca dovada/declaratia de beneficiar real in profilul companiei.");
      }
      if (lower.includes("imputernicire") || lower.includes("imputernicirea")) {
        if (!hasCompanyDocument(documents, "imputernicire")) missing.add("Incarca imputernicirea semnatarului in profilul companiei.");
      }
      if (lower.includes("164") || lower.includes("165") || lower.includes("167")) {
        values.declaratie_neincadrare_164 = true;
        values.declaratie_neincadrare_165 = true;
        values.declaratie_neincadrare_167 = true;
      }
    }

    if (params.workspace.identity.estimatedBudgetNoVat) {
      suggestions.add(`Verifica daca experienta similara acopera pragul financiar din caiet: ${params.workspace.identity.estimatedBudgetNoVat} lei fara TVA.`);
    }
  }

  if (!hasValue(profile.experienta_similara) && !documents.some((doc) => doc.tip === "contract_similar" || doc.tip === "recomandare")) {
    suggestions.add("Completeaza experienta similara si incarca macar contractele/recomandarile relevante pentru formularele de capacitate tehnica.");
  }

  return {
    values,
    missing: Array.from(missing),
    suggestions: Array.from(suggestions),
  };
}

export function inferCompanyProfilePatchFromDocument(params: {
  tip: string;
  text: string;
  currentProfile: CompanyProfile;
}): Partial<CompanyProfile> {
  const normalized = params.text.replace(/\s+/g, " ").trim();
  const patch: Partial<CompanyProfile> = {};

  if (params.tip === "certificat_constatator") {
    patch.denumire = patchIfEmpty(params.currentProfile.denumire, findCompanyName(normalized));
    patch.cui = patchIfEmpty(params.currentProfile.cui, findFirst(normalized, [/(?:cui|cod unic de inregistrare|cod fiscal)[:\s]+([0-9]{5,12})/i]));
    patch.nr_reg_com = patchIfEmpty(params.currentProfile.nr_reg_com, findFirst(normalized, [/(?:j\d{2}\/\d+\/\d{4}|f\d{2}\/\d+\/\d{4}|c\d{2}\/\d+\/\d{4})/i]));
    patch.sediu = patchIfEmpty(params.currentProfile.sediu, findAddress(normalized));
    patch.caen_principal = patchIfEmpty(params.currentProfile.caen_principal, findFirst(normalized, [/(?:caen|cod caen)[:\s-]*(\d{4})/i]));
  }

  if (params.tip === "certificat_fiscal") {
    patch.cui = patchIfEmpty(params.currentProfile.cui, findFirst(normalized, [/(?:cui|cod fiscal)[:\s]+([0-9]{5,12})/i]));
  }

  if (params.tip === "certificat_beneficiar_real") {
    patch.declaratii_json = {
      ...(params.currentProfile.declaratii_json ?? {}),
      declaratie_beneficiar_real: true,
    };
  }

  if (params.tip === "contract_similar" || params.tip === "recomandare") {
    const summary = normalized.slice(0, 900);
    patch.experienta_similara = patchIfEmpty(params.currentProfile.experienta_similara, summary);
  }

  return removeEmptyPatch(patch);
}

export function companyProfileToFlatValues(profile: CompanyProfile): Record<string, unknown> {
  return {
    denumire: profile.denumire ?? "",
    operator_economic: profile.denumire ?? "",
    cui: profile.cui ?? "",
    cod_fiscal: profile.cui ?? "",
    nr_reg_com: profile.nr_reg_com ?? "",
    sediu: profile.sediu ?? "",
    sediu_social: profile.sediu ?? "",
    localitate: profile.localitate ?? "",
    judet: profile.judet ?? "",
    iban: profile.iban ?? "",
    banca: profile.banca ?? "",
    reprezentant_nume: profile.reprezentant_nume ?? "",
    reprezentant_legal: profile.reprezentant_nume ?? "",
    reprezentant_functie: profile.reprezentant_functie ?? "",
    email: profile.email ?? "",
    telefon: profile.telefon ?? "",
    website: profile.website ?? "",
    caen_principal: profile.caen_principal ?? "",
    caen_secundare: profile.caen_secundare ?? "",
    descriere: profile.descriere ?? "",
    experienta_similara: profile.experienta_similara ?? "",
  };
}

export function requiredCompanyProfileFields(profile: CompanyProfile): string[] {
  const checks: Array<[keyof CompanyProfile, string]> = [
    ["denumire", "Lipseste denumirea companiei."],
    ["cui", "Lipseste CUI/CIF."],
    ["nr_reg_com", "Lipseste numarul de inregistrare la Registrul Comertului."],
    ["sediu", "Lipseste sediul social."],
    ["reprezentant_nume", "Lipseste reprezentantul legal."],
    ["reprezentant_functie", "Lipseste functia reprezentantului legal."],
    ["email", "Lipseste emailul oficial."],
    ["telefon", "Lipseste telefonul oficial."],
  ];

  return checks.filter(([key]) => !hasValue(profile[key])).map(([, message]) => message);
}

export function matchCompanyDocumentToDossierItem(title: string, documents: CompanyDocument[]): CompanyDocument | null {
  const lower = normalize(title);
  if (lower.includes("onrc") || lower.includes("constatator")) return findDoc(documents, "certificat_constatator");
  if (lower.includes("fiscal")) return findDoc(documents, "certificat_fiscal");
  if (lower.includes("beneficiar_real")) return findDoc(documents, "certificat_beneficiar_real");
  if (lower.includes("imputernicire") || lower.includes("imputernicirea")) return findDoc(documents, "imputernicire");
  if (lower.includes("contract") || lower.includes("experienta_similara")) return findDoc(documents, "contract_similar");
  if (lower.includes("recomandare")) return findDoc(documents, "recomandare");
  return null;
}

function matchFieldToProfileKey(id: string, label: string): keyof CompanyProfile | null {
  const normalizedId = normalize(id);
  const normalizedLabel = normalize(label);

  for (const [needle, key] of Object.entries(PROFILE_KEY_MAP)) {
    if (normalizedId.includes(needle) || normalizedLabel.includes(normalize(needle))) return key;
  }

  return null;
}

function hasCompanyDocument(documents: CompanyDocument[], tip: string): boolean {
  return documents.some((doc) => doc.tip === tip);
}

function findDoc(documents: CompanyDocument[], tip: string): CompanyDocument | null {
  return documents.find((doc) => doc.tip === tip) ?? null;
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
    if (match?.[0]) return match[0].trim();
  }
  return null;
}

function findCompanyName(text: string): string | null {
  const quoted = text.match(/(?:denumire|firma|societatea)[:\s]+([A-Z0-9 .,&'-]+(?:SRL|S\.R\.L\.|SA|S\.A\.))/i);
  if (quoted?.[1]) return quoted[1].trim();
  const generic = text.match(/([A-Z0-9 .,&'-]+(?:SRL|S\.R\.L\.|SA|S\.A\.))/);
  return generic?.[1]?.trim() ?? null;
}

function findAddress(text: string): string | null {
  const match = text.match(/(?:sediu social|sediul social|adresa sediului social|sediu)[:\s]+(.{20,240}?)(?:cui|cod unic|nr\.? reg|registrul|caen|administrator|$)/i);
  return match?.[1]?.trim().replace(/[;,.\s]+$/, "") ?? null;
}

function patchIfEmpty(current: string | null | undefined, next: string | null): string | undefined {
  if (hasValue(current) || !next?.trim()) return undefined;
  return next.trim();
}

function removeEmptyPatch(patch: Partial<CompanyProfile>): Partial<CompanyProfile> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null && value !== "")) as Partial<CompanyProfile>;
}
