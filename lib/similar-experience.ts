import type { TenderWorkspace } from "@/lib/tender-workspace";

export type SimilarContract = {
  id?: string;
  titlu: string;
  beneficiar?: string | null;
  obiect?: string | null;
  valoare_fara_tva?: number | null;
  moneda?: string | null;
  data_contract?: string | null;
  data_finalizare?: string | null;
  domenii_text?: string | null;
  text_extras?: string | null;
  nume_fisier?: string | null;
  signed_url?: string | null;
};

export type SimilarExperienceEligibility = {
  eligible: boolean;
  requiredValue: number;
  eligibleValue: number;
  selectedContractIds: string[];
  selectedContracts: SimilarContract[];
  missing: string[];
  warnings: string[];
  relevantKeywords: string[];
};

const TRAINING_KEYWORDS = ["formare", "instruire", "training", "curs", "educatie", "invatamant", "trainer", "workshop"];
const PROJECT_KEYWORDS = ["management", "proiect", "fonduri", "implementare", "monitorizare", "consultanta"];
const DNSH_KEYWORDS = ["dnsh", "mediu", "clima", "taxonomie", "sustenabil", "evaluare de mediu"];

export function inferSimilarContractFromText(text: string, fallbackTitle: string): Partial<SimilarContract> {
  const compact = text.replace(/\s+/g, " ").trim();
  return removeEmpty({
    titlu: findTitle(compact) ?? fallbackTitle,
    beneficiar: findFirst(compact, [/(?:beneficiar|achizitor|autoritate contractanta)[:\s]+(.{4,120}?)(?:,|;|\.| contract| obiect| valoare|$)/i]),
    obiect: findFirst(compact, [/(?:obiectul contractului|obiect contract|obiect)[:\s]+(.{10,260}?)(?:valoare|pret|durata|perioada|beneficiar|$)/i]),
    valoare_fara_tva: findValue(compact),
    data_contract: findFirst(compact, [/(?:data contractului|contract nr\.?[^,;]*)[,;\s]+(?:din\s*)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i, /(?:din data de|din)\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i]),
    data_finalizare: findFirst(compact, [/(?:finalizat|finalizare|proces verbal de receptie|receptie)[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i]),
    domenii_text: detectDomains(compact).join(", "),
  });
}

export function analyzeEligibility(params: {
  contracts: SimilarContract[];
  workspace?: TenderWorkspace | null;
  requiredValue?: number | null;
  maxContracts?: number;
  yearsBack?: number;
}): SimilarExperienceEligibility {
  const maxContracts = params.maxContracts ?? 3;
  const yearsBack = params.yearsBack ?? 3;
  const requiredValue = params.requiredValue ?? params.workspace?.identity.estimatedBudgetNoVat ?? 0;
  const relevantKeywords = tenderKeywords(params.workspace ?? null);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsBack);

  const scored = params.contracts.map((contract) => {
    const value = Number(contract.valoare_fara_tva ?? 0);
    const text = normalize([contract.titlu, contract.beneficiar, contract.obiect, contract.domenii_text, contract.text_extras].filter(Boolean).join(" "));
    const keywordScore = relevantKeywords.filter((kw) => text.includes(normalize(kw))).length;
    const date = parseLooseDate(contract.data_finalizare || contract.data_contract || "");
    const recent = date ? date >= cutoff : true;
    return { contract, value, keywordScore, recent, score: keywordScore * 1000000000 + value };
  });

  const relevant = scored
    .filter((item) => item.value > 0 && item.recent && (relevantKeywords.length === 0 || item.keywordScore > 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxContracts);

  const eligibleValue = relevant.reduce((sum, item) => sum + item.value, 0);
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!requiredValue) warnings.push("Nu am gasit prag financiar clar in licitatie. Verifica manual cerinta de experienta similara.");
  if (requiredValue && eligibleValue < requiredValue) missing.push(`Experienta similara eligibila este ${formatMoney(eligibleValue)}, sub pragul estimat de ${formatMoney(requiredValue)}.`);
  if (!relevant.length) missing.push("Nu exista contracte relevante detectate pentru obiectul licitatiei.");
  if (params.contracts.some((c) => !c.valoare_fara_tva)) warnings.push("Unele contracte nu au valoare fara TVA completata, deci nu intra corect in calcul.");
  if (params.contracts.some((c) => !c.data_contract && !c.data_finalizare)) warnings.push("Unele contracte nu au data/finalizare completata. Verifica cerinta ultimilor 3 ani.");

  return {
    eligible: !!requiredValue && eligibleValue >= requiredValue && relevant.length > 0,
    requiredValue,
    eligibleValue,
    selectedContractIds: relevant.map((item) => item.contract.id).filter(Boolean) as string[],
    selectedContracts: relevant.map((item) => item.contract),
    missing,
    warnings,
    relevantKeywords,
  };
}

function tenderKeywords(workspace: TenderWorkspace | null): string[] {
  const text = normalize([
    workspace?.identity.title,
    workspace?.identity.cpv,
    ...(workspace?.courses?.map((c) => c.title) ?? []),
  ].filter(Boolean).join(" "));
  const keywords = new Set<string>();
  if (/formare|instruire|training|curs|educatie|invatamant/.test(text)) TRAINING_KEYWORDS.forEach((kw) => keywords.add(kw));
  if (/management|proiect|consultanta|fonduri|implementare/.test(text)) PROJECT_KEYWORDS.forEach((kw) => keywords.add(kw));
  if (/dnsh|mediu|clima|sustenabil/.test(text)) DNSH_KEYWORDS.forEach((kw) => keywords.add(kw));
  return Array.from(keywords);
}

function detectDomains(text: string): string[] {
  const normalized = normalize(text);
  const domains: string[] = [];
  if (TRAINING_KEYWORDS.some((kw) => normalized.includes(normalize(kw)))) domains.push("formare/instruire");
  if (PROJECT_KEYWORDS.some((kw) => normalized.includes(normalize(kw)))) domains.push("management proiect/consultanta");
  if (DNSH_KEYWORDS.some((kw) => normalized.includes(normalize(kw)))) domains.push("DNSH/mediu");
  return domains;
}

function findValue(text: string): number | null {
  const matches = Array.from(text.matchAll(/([0-9][0-9 .,_]{2,})\s*(?:lei|ron)/gi));
  const values = matches
    .map((m) => Number(m[1].replace(/[ ._]/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 100);
  return values.length ? Math.max(...values) : null;
}

function findTitle(text: string): string | null {
  return findFirst(text, [/(?:contract(?:ul)?\s+(?:de)?\s*)(.{8,120}?)(?:nr\.?|numarul|din|,|;)/i]);
}

function findFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[;,.\s]+$/, "");
  }
  return null;
}

function parseLooseDate(value: string): Date | null {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(value)} lei fara TVA`;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[șş]/g, "s").replace(/[țţ]/g, "t");
}

function removeEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== null && value !== undefined && value !== "")) as Partial<T>;
}
