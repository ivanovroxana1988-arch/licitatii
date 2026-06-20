export type ExpertRoleInput = {
  id: string;
  title: string;
  domain?: string;
  minimumRequirements?: string[];
  winningRequirements?: string[];
};

export type ExpertDocumentInput = {
  tip: string;
  nume_fisier: string;
  text_extras?: string | null;
};

export type ExpertRoleAnalysis = {
  roleId: string;
  roleTitle: string;
  score: number;
  punctajEstimat: number;
  verdict: "foarte_potrivit" | "potrivit" | "partial" | "nepotrivit";
  motive: string[];
  lipsuri: string[];
};

export type ExpertAnalysisResult = {
  score: number;
  bestRoleId: string | null;
  recomandare: string;
  flags: string[];
  extracted: {
    sessions: number;
    hasTrainerCertificate: boolean;
    hasUniversityStudies: boolean;
    hasRecommendations: boolean;
    hasContracts: boolean;
    documentTypes: string[];
  };
  roles: ExpertRoleAnalysis[];
};

const KEYWORDS: Record<string, string[]> = {
  "expert-achizitii": [
    "achizitii publice",
    "achizitie publica",
    "legea 98",
    "seap",
    "sicAP",
    "caiet de sarcini",
    "procedura simplificata",
    "criterii de atribuire",
    "conflict de interese",
  ],
  "expert-proiecte": [
    "fonduri europene",
    "implementare proiecte",
    "management de proiect",
    "proiecte cu finantare europeana",
    "raportare",
    "cerere de rambursare",
    "monitorizare",
    "program regional",
    "pr sud-est",
  ],
  "expert-dnsh": [
    "dnsh",
    "do no significant harm",
    "principiul dnsh",
    "mediu",
    "schimbari climatice",
    "taxonomie",
    "evaluare de mediu",
    "principiul de a nu prejudicia",
  ],
};

export function analyzeExpertCompatibility(params: {
  roles: ExpertRoleInput[];
  documents: ExpertDocumentInput[];
}): ExpertAnalysisResult {
  const fullText = normalize(
    params.documents
      .map((doc) => `${doc.tip} ${doc.nume_fisier}\n${doc.text_extras ?? ""}`)
      .join("\n\n")
  );
  const documentTypes = params.documents.map((doc) => doc.tip);
  const hasTrainerCertificate = hasAny(fullText, ["formator", "242401", "trainer", "certificat de formator"])
    || documentTypes.includes("certificat_formator");
  const hasUniversityStudies = hasAny(fullText, ["licenta", "master", "universitar", "facultate", "diploma", "studii superioare"])
    || documentTypes.includes("diploma");
  const hasRecommendations = documentTypes.includes("recomandare") || hasAny(fullText, ["recomandare", "beneficiar", "scrisoare de recomandare"]);
  const hasContracts = documentTypes.includes("contract") || hasAny(fullText, ["contract", "prestari servicii", "servicii de formare"]);
  const sessions = extractSessions(fullText);

  const flags: string[] = [];
  if (!hasTrainerCertificate) flags.push("Lipseste dovada clara pentru certificat de formator.");
  if (!hasUniversityStudies) flags.push("Lipseste dovada clara pentru studii universitare relevante.");
  if (!hasRecommendations) flags.push("Nu exista recomandare incarcata sau detectata in documente.");
  if (!hasContracts) flags.push("Nu exista contracte/dovezi contractuale incarcate sau detectate.");
  if (sessions < 7) flags.push("Pentru punctaj maxim ar fi utila dovada pentru minimum 7 sesiuni relevante.");

  const roles = params.roles.map((role) => analyzeRole({ role, fullText, sessions, hasTrainerCertificate, hasUniversityStudies, hasContracts, hasRecommendations }));
  const best = [...roles].sort((a, b) => b.score - a.score)[0];
  const score = best?.score ?? 0;

  return {
    score,
    bestRoleId: best?.score ? best.roleId : null,
    recomandare: recommendationFor(best, flags),
    flags,
    extracted: {
      sessions,
      hasTrainerCertificate,
      hasUniversityStudies,
      hasRecommendations,
      hasContracts,
      documentTypes,
    },
    roles,
  };
}

function analyzeRole(params: {
  role: ExpertRoleInput;
  fullText: string;
  sessions: number;
  hasTrainerCertificate: boolean;
  hasUniversityStudies: boolean;
  hasContracts: boolean;
  hasRecommendations: boolean;
}): ExpertRoleAnalysis {
  const roleKeywords = KEYWORDS[params.role.id] ?? keywordFallback(params.role);
  const matches = roleKeywords.filter((keyword) => params.fullText.includes(normalize(keyword)));
  const keywordScore = Math.min(35, matches.length * 7);
  const sessionsScore = params.sessions >= 7 ? 25 : params.sessions >= 4 ? 16 : params.sessions >= 2 ? 8 : params.sessions >= 1 ? 4 : 0;
  const certificateScore = params.hasTrainerCertificate ? 15 : 0;
  const studiesScore = params.hasUniversityStudies ? 10 : 0;
  const evidenceScore = (params.hasContracts ? 8 : 0) + (params.hasRecommendations ? 7 : 0);
  const score = clamp(keywordScore + sessionsScore + certificateScore + studiesScore + evidenceScore);

  const lipsuri: string[] = [];
  if (!matches.length) lipsuri.push(`Nu am detectat termeni clari pentru rolul ${params.role.title}.`);
  if (params.sessions < 1) lipsuri.push("Nu am detectat minimum o sesiune de instruire relevanta.");
  if (params.sessions < 7) lipsuri.push("Pentru punctaj maxim lipsesc dovezi pentru 7-10 sesiuni relevante.");
  if (!params.hasTrainerCertificate) lipsuri.push("Lipseste certificat de formator sau echivalent.");
  if (!params.hasUniversityStudies) lipsuri.push("Lipseste dovada de studii universitare.");
  if (!params.hasContracts) lipsuri.push("Lipsesc contracte/adeverinte/livrabile care sustin experienta.");

  const motive: string[] = [];
  if (matches.length) motive.push(`Potrivire pe termeni: ${matches.slice(0, 6).join(", ")}.`);
  if (params.sessions) motive.push(`Am detectat aproximativ ${params.sessions} sesiuni/programe de instruire.`);
  if (params.hasTrainerCertificate) motive.push("Exista indiciu pentru certificat de formator.");
  if (params.hasUniversityStudies) motive.push("Exista indiciu pentru studii universitare.");
  if (params.hasContracts || params.hasRecommendations) motive.push("Exista documente suport pentru experienta.");

  return {
    roleId: params.role.id,
    roleTitle: params.role.title,
    score,
    punctajEstimat: estimatedTenderPoints(params.sessions),
    verdict: verdict(score),
    motive,
    lipsuri,
  };
}

function extractSessions(text: string): number {
  const values: number[] = [];
  const patterns = [
    /(\d{1,3})\s+(?:sesiuni|sesiune|traininguri|cursuri|programe)\s+(?:de\s+)?(?:instruire|formare)?/gi,
    /(?:sesiuni|sesiune|traininguri|cursuri|programe)\s+(?:de\s+)?(?:instruire|formare)?[^\d]{0,20}(\d{1,3})/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 100) values.push(parsed);
    }
  }

  if (!values.length && hasAny(text, ["formator", "instruire", "training", "curs"])) return 1;
  return Math.max(0, ...values);
}

function estimatedTenderPoints(sessions: number): number {
  if (sessions >= 7) return 10;
  if (sessions >= 4) return 5;
  if (sessions >= 2) return 1;
  return 0;
}

function recommendationFor(best: ExpertRoleAnalysis | undefined, flags: string[]): string {
  if (!best) return "Nu exista suficiente documente pentru recomandare.";
  if (best.score >= 80) return `Recomandat pentru ${best.roleTitle}. Poate fi alocat dupa verificarea documentelor originale.`;
  if (best.score >= 60) return `Potrivit pentru ${best.roleTitle}, dar necesita completari: ${flags.slice(0, 2).join(" ")}`;
  if (best.score >= 40) return `Compatibilitate partiala pentru ${best.roleTitle}. Cere documente suplimentare inainte de alocare.`;
  return "Nu recomand alocarea pana nu sunt incarcate dovezi mai clare. Stiu, brutal, dar mai ieftin decat o oferta neconforma.";
}

function verdict(score: number): ExpertRoleAnalysis["verdict"] {
  if (score >= 80) return "foarte_potrivit";
  if (score >= 60) return "potrivit";
  if (score >= 40) return "partial";
  return "nepotrivit";
}

function keywordFallback(role: ExpertRoleInput): string[] {
  return [role.title, role.domain ?? "", ...(role.minimumRequirements ?? []), ...(role.winningRequirements ?? [])]
    .flatMap((item) => normalize(item).split(/[;,]/g))
    .map((item) => item.trim())
    .filter((item) => item.length > 4)
    .slice(0, 12);
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(normalize(needle)));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
