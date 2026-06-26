export type CandidateKind = "company" | "association";

export type MatchInput = {
  tender: { id: string; nume?: string | null; referinta?: string | null; beneficiar?: string | null };
  candidate: {
    kind: CandidateKind;
    id: string;
    name: string;
    caenCodes: string[];
    cpvCodes: string[];
    experiences: Array<{ title?: string | null; domain?: string | null; cpv_code?: string | null; value?: number | null }>;
    memberCount?: number;
    totalShare?: number;
    hasLeader?: boolean;
    missingResponsibilities?: number;
  };
};

export function buildTenderMatch(input: MatchInput) {
  const text = clean([input.tender.nume, input.tender.referinta, input.tender.beneficiar].filter(Boolean).join(" "));
  const cpvHits = input.candidate.cpvCodes.filter((code) => codeHit(code, text));
  const caenHits = input.candidate.caenCodes.filter((code) => codeHit(code, text));
  const expHits = input.candidate.experiences.filter((item) => expHit(item, text));

  const scores = {
    cpv: codeScore(input.candidate.cpvCodes.length, cpvHits.length),
    caen: codeScore(input.candidate.caenCodes.length, caenHits.length),
    similar_experience: expScore(input.candidate.experiences.length, expHits.length),
    structure: structureScore(input.candidate),
    documents: 50,
    overall: 0,
  };

  scores.overall = Math.round(scores.cpv * 0.25 + scores.caen * 0.15 + scores.similar_experience * 0.30 + scores.structure * 0.20 + scores.documents * 0.10);

  const strengths: string[] = [];
  const warnings: string[] = [];

  if (cpvHits.length) strengths.push(`CPV potrivit: ${cpvHits.join(", ")}.`);
  else if (input.candidate.cpvCodes.length) warnings.push("Exista CPV in profil, dar nu apare potrivire directa in textul licitatiei.");
  else warnings.push("Nu exista CPV salvat pe candidat.");

  if (caenHits.length) strengths.push(`CAEN regasit: ${caenHits.join(", ")}.`);
  else if (!input.candidate.caenCodes.length) warnings.push("Nu exista CAEN salvat pe candidat.");

  if (expHits.length) strengths.push(`${expHits.length} experiente similare par relevante.`);
  else if (input.candidate.experiences.length) warnings.push("Exista experienta similara, dar nu apare potrivire directa cu textul licitatiei.");
  else warnings.push("Nu exista experienta similara salvata.");

  if (input.candidate.kind === "association") {
    if (!input.candidate.hasLeader) warnings.push("Asocierea nu are lider setat.");
    if ((input.candidate.memberCount ?? 0) < 2) warnings.push("Asocierea are mai putin de doi membri.");
    if (input.candidate.totalShare && Math.abs(input.candidate.totalShare - 100) > 0.01) warnings.push(`Ponderile insumeaza ${input.candidate.totalShare}%, nu 100%.`);
    if ((input.candidate.missingResponsibilities ?? 0) > 0) warnings.push(`${input.candidate.missingResponsibilities} membri nu au responsabilitate completata.`);
  }

  return {
    scores,
    recommendation: recommendation(scores.overall, warnings.length),
    strengths,
    warnings,
    evidence: [
      `Candidat: ${input.candidate.name}.`,
      `CAEN salvate: ${input.candidate.caenCodes.length}.`,
      `CPV salvate: ${input.candidate.cpvCodes.length}.`,
      `Experiente similare salvate: ${input.candidate.experiences.length}.`,
    ],
  };
}

function clean(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function codeHit(code: string, text: string) {
  const cleanCode = String(code).replace(/\D/g, "");
  return Boolean(cleanCode && (text.includes(cleanCode) || (cleanCode.length >= 4 && text.includes(cleanCode.slice(0, 4)))));
}

function expHit(item: { title?: string | null; domain?: string | null; cpv_code?: string | null }, text: string) {
  if (item.cpv_code && codeHit(item.cpv_code, text)) return true;
  return clean([item.title, item.domain].filter(Boolean).join(" ")).split(/\W+/).filter((word) => word.length >= 5).some((word) => text.includes(word));
}

function codeScore(total: number, hits: number) {
  if (!total) return 0;
  return hits ? Math.min(100, 70 + hits * 10) : 40;
}

function expScore(total: number, hits: number) {
  if (!total) return 0;
  return hits ? Math.min(100, 70 + hits * 10) : 45;
}

function structureScore(candidate: MatchInput["candidate"]) {
  if (candidate.kind === "company") return 70;
  let score = 40;
  if (candidate.hasLeader) score += 20;
  if ((candidate.memberCount ?? 0) >= 2) score += 20;
  if (candidate.totalShare && Math.abs(candidate.totalShare - 100) <= 0.01) score += 10;
  if (!(candidate.missingResponsibilities ?? 0)) score += 10;
  return Math.min(100, score);
}

function recommendation(overall: number, warningCount: number) {
  if (overall >= 75 && warningCount <= 2) return "bid";
  if (overall >= 55) return "bid_with_warnings";
  if (overall >= 40) return "needs_clarification";
  return "do_not_bid";
}
