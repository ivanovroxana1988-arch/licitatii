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
  caen_autorizate_la_sediu?: string | null;
  caen_autorizate_la_terti?: string | null;
  caen_relevante_licitatie?: string | null;
  caen_sursa_validare?: string | null;
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

type CaenItem = { code: string; label: string };

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
  caen_autorizate_la_sediu: "caen_autorizate_la_sediu",
  caen_autorizate_la_terti: "caen_autorizate_la_terti",
  caen_relevante: "caen_relevante_licitatie",
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

  requiredCompanyProfileFields(profile).forEach((item) => missing.add(item));
  Object.assign(values, companyProfileToFlatValues(profile));

  const relevantCaen = pickRelevantCaenForTender(profile, params.workspace ?? null);
  if (relevantCaen) {
    values.caen_relevante_licitatie = relevantCaen;
    values.caen_relevant = relevantCaen;
  }

  for (const [key, fallback] of Object.entries(DECLARATION_DEFAULTS)) {
    const explicit = profile.declaratii_json?.[key];
    values[key] = typeof explicit === "boolean" ? explicit : fallback;
  }

  const fields = params.formularConfig?.sections.flatMap((section) => section.fields) ?? [];
  for (const field of fields) {
    const matchKey = matchFieldToProfileKey(field.id, field.label);
    if (matchKey) {
      const value = values[field.id] ?? profile[matchKey];
      if (hasValue(value)) values[field.id] = value;
      else if (field.required) missing.add(`Lipseste ${field.label} in profilul companiei.`);
    }
  }

  for (const document of documents) {
    values[`document_${document.tip}`] = document.nume_fisier;
  }

  if (params.workspace) {
    for (const doc of params.workspace.dossier.administrativeDocuments) {
      const lower = normalize(doc);
      if ((lower.includes("onrc") || lower.includes("constatator")) && !hasCompanyDocument(documents, "certificat_constatator")) missing.add("Incarca certificatul constatator ONRC in profilul companiei.");
      if (lower.includes("fiscal") && !hasCompanyDocument(documents, "certificat_fiscal")) missing.add("Incarca certificatul fiscal in profilul companiei.");
      if (lower.includes("beneficiar_real")) {
        values.declaratie_beneficiar_real = true;
        if (!hasCompanyDocument(documents, "certificat_beneficiar_real")) missing.add("Incarca dovada/declaratia de beneficiar real in profilul companiei.");
      }
      if ((lower.includes("imputernicire") || lower.includes("imputernicirea")) && !hasCompanyDocument(documents, "imputernicire")) missing.add("Incarca imputernicirea semnatarului in profilul companiei.");
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

  if (!relevantCaen && params.workspace) {
    suggestions.add("Nu am identificat automat CAEN relevant pentru aceasta licitatie. Verifica manual CAEN principal/secundare si cele autorizate.");
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
  const raw = params.text.replace(/\r/g, "").trim();
  const compact = raw.replace(/\s+/g, " ").trim();
  const patch: Partial<CompanyProfile> = {};

  if (params.tip === "certificat_constatator") {
    const parsed = parseConstatator(raw);
    patch.denumire = patchIfEmpty(params.currentProfile.denumire, parsed.denumire ?? findCompanyName(compact));
    patch.cui = patchIfEmpty(params.currentProfile.cui, parsed.cui ?? findFirst(compact, [/(?:cui|cod unic de inregistrare|cod fiscal)[:\s]+([0-9]{5,12})/i]));
    patch.nr_reg_com = patchIfEmpty(params.currentProfile.nr_reg_com, parsed.nrRegCom ?? findFirst(compact, [/(?:j\d{2}\/\d+\/\d{4}|f\d{2}\/\d+\/\d{4}|c\d{2}\/\d+\/\d{4})/i]));
    patch.sediu = patchIfEmpty(params.currentProfile.sediu, parsed.sediu ?? findAddress(compact));
    patch.caen_principal = patchIfEmpty(params.currentProfile.caen_principal, formatCaenList(parsed.caenPrincipal) || findFirst(compact, [/(?:caen|cod caen)[:\s-]*(\d{4})/i]));
    patch.caen_secundare = patchIfEmpty(params.currentProfile.caen_secundare, formatCaenList(parsed.caenSecundare));
    patch.caen_autorizate_la_sediu = patchIfEmpty(params.currentProfile.caen_autorizate_la_sediu, formatCaenList(parsed.caenAutorizateSediu));
    patch.caen_autorizate_la_terti = patchIfEmpty(params.currentProfile.caen_autorizate_la_terti, formatCaenList(parsed.caenAutorizateTerti));
    patch.caen_sursa_validare = "Certificat constatator ONRC";
    patch.reprezentant_nume = patchIfEmpty(params.currentProfile.reprezentant_nume, parsed.reprezentantNume);
    patch.reprezentant_functie = patchIfEmpty(params.currentProfile.reprezentant_functie, parsed.reprezentantFunctie);
  }

  if (params.tip === "certificat_fiscal") {
    patch.cui = patchIfEmpty(params.currentProfile.cui, findFirst(compact, [/(?:cui|cod fiscal)[:\s]+([0-9]{5,12})/i]));
  }

  if (params.tip === "certificat_beneficiar_real") {
    patch.declaratii_json = {
      ...(params.currentProfile.declaratii_json ?? {}),
      declaratie_beneficiar_real: true,
    };
  }

  if (params.tip === "contract_similar" || params.tip === "recomandare") {
    patch.experienta_similara = patchIfEmpty(params.currentProfile.experienta_similara, compact.slice(0, 900));
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
    caen_autorizate_la_sediu: profile.caen_autorizate_la_sediu ?? "",
    caen_autorizate_la_terti: profile.caen_autorizate_la_terti ?? "",
    caen_relevante_licitatie: profile.caen_relevante_licitatie ?? "",
    caen_sursa_validare: profile.caen_sursa_validare ?? "",
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

function parseConstatator(raw: string): {
  denumire: string | null;
  cui: string | null;
  nrRegCom: string | null;
  sediu: string | null;
  reprezentantNume: string | null;
  reprezentantFunctie: string | null;
  caenPrincipal: CaenItem[];
  caenSecundare: CaenItem[];
  caenAutorizateSediu: CaenItem[];
  caenAutorizateTerti: CaenItem[];
} {
  const compact = raw.replace(/\s+/g, " ");
  const mainSection = sliceBetween(raw, /ACTIVITATE PRINCIPAL[AĂ]/i, /ACTIVIT[AĂ][TŢ]I SECUNDARE|EMBLEME|FILIALE|SEDII SECUNDARE/i);
  const secondarySection = sliceBetween(raw, /ACTIVIT[AĂ][TŢ]I SECUNDARE/i, /EMBLEME|FILIALE|SEDII SECUNDARE|SEDII ŞI\/SAU ACTIVIT[AĂ][TŢ]I AUTORIZATE/i);
  const tertiSection = sliceBetween(raw, /Activit[aăţt\s]+în afara sediului social[^:]*:/i, /Data certificatului constatator|Sediul social din|Tip sediu|Conform declara/i);
  const sediuSection = sliceBetween(raw, /Activit[aăţt\s]+la sediu[^:]*:/i, /Data certificatului constatator|DREPTURI DE PROPRIETATE|ACORD DE RESTRUCTURARE/i);
  const representativeSection = sliceBetween(raw, /PERSOANE [ÎI]MPUTERNICITE \(PERSOANE FIZICE\)/i, /ADMINISTRATORI JUDICIARI|CURATOR|CENZORI|ACTIVITATE PRINCIPAL[AĂ]/i);

  return {
    denumire: findCompanyName(compact),
    cui: findFirst(compact, [/(?:cod unic de înregistrare|cod unic de inregistrare|cui|cod fiscal)\s*:?\s*([0-9]{5,12})/i]),
    nrRegCom: findFirst(compact, [/(?:num[aă]r de ordine [^:]*|registrul comer[tţ]ului)\s*:?\s*(J\d{2}\/\d+\/\d{4})/i, /(J\d{2}\/\d+\/\d{4})/i]),
    sediu: findAddress(compact),
    reprezentantNume: findRepresentativeName(representativeSection),
    reprezentantFunctie: representativeSection ? "administrator" : null,
    caenPrincipal: extractCaenList(mainSection),
    caenSecundare: extractCaenList(secondarySection),
    caenAutorizateSediu: extractCaenList(sediuSection),
    caenAutorizateTerti: extractCaenList(tertiSection),
  };
}

function sliceBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = start.exec(text);
  if (!startMatch?.index && startMatch?.index !== 0) return "";
  const afterStart = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = end.exec(afterStart);
  return endMatch?.index !== undefined ? afterStart.slice(0, endMatch.index) : afterStart;
}

function extractCaenList(text: string): CaenItem[] {
  if (!text) return [];
  const normalizedText = text.replace(/\r/g, "").replace(/\t/g, " ");
  const items: CaenItem[] = [];
  const lineRegex = /(\d{4})\s*-\s*([^\n]+?)(?=\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(normalizedText)) !== null) {
    const item = cleanCaenItem(match[1], match[2]);
    if (item && !items.some((existing) => existing.code === item.code)) items.push(item);
  }

  if (!items.length) {
    const compactRegex = /(\d{4})\s*-\s*([^0-9]+?)(?=\s+\d{4}\s*-|$)/g;
    const compact = normalizedText.replace(/\s+/g, " ");
    while ((match = compactRegex.exec(compact)) !== null) {
      const item = cleanCaenItem(match[1], match[2]);
      if (item && !items.some((existing) => existing.code === item.code)) items.push(item);
    }
  }

  return items;
}

function cleanCaenItem(code: string, label: string): CaenItem | null {
  const cleanCode = code.trim();
  const cleanLabel = label.replace(/N9NPMTDN3.*$/i, "").replace(/Raport generat.*$/i, "").replace(/[;\s]+$/g, "").trim();
  if (!/^\d{4}$/.test(cleanCode) || cleanLabel.length < 3) return null;
  return { code: cleanCode, label: cleanLabel };
}

function formatCaenList(items: CaenItem[]): string | null {
  if (!items.length) return null;
  return items.map((item) => `${item.code} - ${item.label}`).join("\n");
}

function pickRelevantCaenForTender(profile: CompanyProfile, workspace: TenderWorkspace | null): string | null {
  const available = extractCaenList([
    profile.caen_principal,
    profile.caen_secundare,
    profile.caen_autorizate_la_sediu,
    profile.caen_autorizate_la_terti,
  ].filter(Boolean).join("\n"));
  if (!available.length) return profile.caen_relevante_licitatie ?? null;

  const tenderText = normalize([
    workspace?.identity.title,
    workspace?.identity.cpv,
    workspace?.identity.procedureType,
    ...(workspace?.courses?.map((course) => course.title) ?? []),
  ].filter(Boolean).join(" "));

  const preferredCodes: string[] = [];
  if (/formare|instruire|training|educatie|invatamant|curs/.test(tenderText)) preferredCodes.push("8559", "8560", "8551", "8552", "7022", "7021");
  if (/consultanta|management|proiect/.test(tenderText)) preferredCodes.push("7022", "7021");
  if (/eveniment|congres|targ|expozit/.test(tenderText)) preferredCodes.push("8230");

  const selected = available.filter((item) => preferredCodes.includes(item.code));
  return formatCaenList(selected) ?? profile.caen_relevante_licitatie ?? null;
}

function findRepresentativeName(text: string): string | null {
  if (!text) return null;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const nameLine = lines.find((line) => /^[A-ZĂÂÎȘŞȚŢ][A-ZĂÂÎȘŞȚŢ \-']{5,}$/.test(line) && !/NU EXIST|PERSOANE|CALITATE|CET/.test(line));
  return nameLine ?? null;
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
    if (match?.[1]) return match[1].trim().replace(/[;,.\s]+$/, "");
    if (match?.[0]) return match[0].trim().replace(/[;,.\s]+$/, "");
  }
  return null;
}

function findCompanyName(text: string): string | null {
  const quoted = text.match(/(?:referitoare la|denumire|firma|societatea)[:\s]+([A-Z0-9 .,&'-]+(?:SRL|S\.R\.L\.|S\.R\.L|SA|S\.A\.))/i);
  if (quoted?.[1]) return quoted[1].trim();
  const generic = text.match(/([A-Z0-9 .,&'-]+(?:SRL|S\.R\.L\.|S\.R\.L|SA|S\.A\.))/);
  return generic?.[1]?.trim() ?? null;
}

function findAddress(text: string): string | null {
  const match = text.match(/(?:adres[aă] sediu social|sediu social|sediul social|adresa sediului social|sediu)[:\s]+(.{20,240}?)(?:actul|cui|cod unic|nr\.? reg|registrul|caen|administrator|stare firm[aă]|$)/i);
  return match?.[1]?.trim().replace(/[;,.\s]+$/, "") ?? null;
}

function patchIfEmpty(current: string | null | undefined, next: string | null): string | undefined {
  if (hasValue(current) || !next?.trim()) return undefined;
  return next.trim();
}

function removeEmptyPatch(patch: Partial<CompanyProfile>): Partial<CompanyProfile> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null && value !== "")) as Partial<CompanyProfile>;
}
