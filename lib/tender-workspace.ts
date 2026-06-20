import type { FormularConfig } from "@/lib/form-schema";

export type TenderCourse = {
  id: string;
  title: string;
  sessions: number;
  daysPerSession: number;
  format: "fizic" | "online" | "hibrid";
  keyTopics: string[];
  practicalElements: string[];
};

export type TenderExpertRole = {
  id: string;
  title: string;
  domain: string;
  minimumRequirements: string[];
  winningRequirements: string[];
  requiredDocuments: string[];
};

export type TenderWorkspace = {
  identity: {
    title: string;
    reference: string;
    beneficiary: string;
    procedureType: string;
    cpv: string;
    estimatedBudgetNoVat: number | null;
    submissionDeadline: string;
    fundingSource: string;
    sourceSummary: string;
  };
  award: {
    criterion: string;
    technicalWeight: number;
    financialWeight: number;
    methodologyPoints: number;
    expertsPoints: number;
    financialPoints: number;
    financialFormula: string;
  };
  courses: TenderCourse[];
  experts: TenderExpertRole[];
  methodology: {
    requiredScoreLogic: string[];
    implementationFlow: string[];
    qualityAssurance: string[];
    risks: { risk: string; mitigation: string }[];
  };
  dossier: {
    administrativeDocuments: string[];
    expertDocuments: string[];
    technicalProposalSections: string[];
    finalChecks: string[];
  };
  timeline: { label: string; due: string; owner: string }[];
  warnings: string[];
};

const DEFAULT_TITLE = "Servicii de formare specializata pentru personalul institutiilor beneficiare PR Sud-Est 2021-2027";

export function buildTenderWorkspaceFromText(text: string): TenderWorkspace {
  const clean = normalize(text);
  const budget = extractNumberBefore(clean, /lei\s*(?:fara|far[aă])?\s*tva/i) ?? 117000;
  const deadline = extractDeadline(clean) ?? "24.06.2026, ora 11:00";
  const beneficiary = includes(clean, "Agentia pentru Dezvoltare Regionala") || includes(clean, "ADR SE")
    ? "Agentia pentru Dezvoltare Regionala Sud-Est / AM PR SE"
    : "Beneficiar extras din caietul de sarcini";

  return {
    identity: {
      title: includes(clean, "Servicii de formare specializata") ? DEFAULT_TITLE : firstQuotedTitle(clean) ?? DEFAULT_TITLE,
      reference: "ADR SE - PR SE 2021-2027",
      beneficiary,
      procedureType: includes(clean, "procedura proprie") ? "procedura proprie" : "procedura / achizitie publica",
      cpv: includes(clean, "80500000-9") ? "80500000-9 Servicii formare" : "80500000-9 Servicii formare",
      estimatedBudgetNoVat: budget,
      submissionDeadline: deadline,
      fundingSource: includes(clean, "SMIS 338556")
        ? "PR SE 2021-2027, Prioritatea 7 Asistenta Tehnica, cod SMIS 338556"
        : "Sursa de finantare de verificat in documentatie",
      sourceSummary:
        "Program de formare pentru institutiile beneficiare PR SE, orientat pe achizitii publice, managementul proiectelor si DNSH.",
    },
    award: {
      criterion: "Cel mai bun raport calitate-pret",
      technicalWeight: 60,
      financialWeight: 40,
      methodologyPoints: 30,
      expertsPoints: 30,
      financialPoints: 40,
      financialFormula: "Scor financiar = pret minim * 40 / pret ofertat",
    },
    courses: [
      {
        id: "achizitii-publice",
        title: "Achizitii publice",
        sessions: 4,
        daysPerSession: 2,
        format: "fizic",
        keyTopics: [
          "caiete de sarcini",
          "criterii de evaluare si atribuire",
          "prevenirea corectiilor financiare",
          "gestionarea conflictelor de interese",
        ],
        practicalElements: ["exercitii pe caiete de sarcini", "studii de caz pe corectii financiare", "simulari de evaluare"],
      },
      {
        id: "management-proiecte-dnsh",
        title: "Managementul proiectelor si DNSH in implementare",
        sessions: 4,
        daysPerSession: 2,
        format: "fizic",
        keyTopics: [
          "provocari in implementare",
          "raportarea activitatilor",
          "urmarirea DNSH in implementare",
          "urmarirea DNSH post-implementare",
        ],
        practicalElements: ["exercitii de raportare", "matrice risc-masura", "studii de caz din proiecte finantate"],
      },
      {
        id: "implementare-dnsh",
        title: "Implementarea DNSH",
        sessions: 1,
        daysPerSession: 1,
        format: "fizic",
        keyTopics: ["principii DNSH", "documentare", "monitorizare", "dovezi si piste de audit"],
        practicalElements: ["checklist DNSH", "analiza pe exemple", "intrebari de verificare pentru beneficiari"],
      },
    ],
    experts: [
      expertRole("expert-achizitii", "Expert achizitii publice", "achizitii publice"),
      expertRole("expert-proiecte", "Expert implementare proiecte cu finantare europeana", "implementare proiecte"),
      expertRole("expert-dnsh", "Expert DNSH", "DNSH"),
    ],
    methodology: {
      requiredScoreLogic: [
        "Metodologia trebuie sa arate intelegerea contextului PR SE si a grupului tinta.",
        "Temele de instruire trebuie dezvoltate logic, teoretic si practic.",
        "Oferta trebuie sa includa riscuri, ipoteze si masuri clare de control.",
        "Planificarea trebuie sa lege fiecare activitate de resurse, responsabili si livrabile.",
      ],
      implementationFlow: [
        "Kick-off cu AM PR SE si validarea planului de lucru.",
        "Chestionar scurt pentru clarificarea nevoilor practice ale grupului tinta.",
        "Proiectarea continutului, agendelor, prezentarilor, exercitiilor si studiilor de caz.",
        "Transmiterea materialelor cu minimum 3 zile inainte de fiecare sesiune.",
        "Livrarea celor 9 sesiuni fizice de instruire.",
        "Colectarea feedbackului si integrarea concluziilor in raportul final.",
      ],
      qualityAssurance: [
        "revizie interna a materialelor inainte de transmiterea catre AC",
        "aliniere la Ghidul de Identitate Vizuala PR SE 2021-2027",
        "feedback online sau fizic dupa fiecare sesiune",
        "raport final cu participanti, materiale utilizate si evaluarea instruirii",
      ],
      risks: [
        {
          risk: "Participare redusa din cauza incarcarii personalului beneficiarilor.",
          mitigation: "Confirmare calendar din timp, agende clare, continut aplicat si sesiuni construite pe probleme reale.",
        },
        {
          risk: "Comunicare ineficienta intre prestator si AC.",
          mitigation: "Punct unic de contact, minute de intalnire, validari scrise si calendar de livrabile.",
        },
        {
          risk: "Nivel neomogen de cunostinte in grupul tinta.",
          mitigation: "Chestionar initial, exemple pe niveluri si exercitii cu dificultate progresiva.",
        },
      ],
    },
    dossier: {
      administrativeDocuments: [
        "certificat constatator ONRC actual",
        "lista serviciilor similare din ultimii 3 ani, maximum 3 contracte, minimum valoarea estimata fara TVA",
        "documente suport pentru experienta similara",
        "declaratii art. 164, 165, 167 din Legea 98/2016",
        "declaratie art. 59-60 din Legea 98/2016",
        "declaratie beneficiar real",
        "imputernicire, daca este cazul",
        "declaratie privind conditiile de mediu, munca si SSM",
      ],
      expertDocuments: [
        "CV in formatul formularului specific",
        "declaratie de disponibilitate semnata",
        "certificat Formator recunoscut national sau echivalent",
        "diplome de studii relevante",
        "contracte, recomandari, adeverinte, livrabile sau fise de post care dovedesc sesiunile relevante",
      ],
      technicalProposalSections: [
        "Intelegerea contextului si a grupului tinta",
        "Obiectivele programului de formare",
        "Metodologia de implementare",
        "Structura modulelor si continutul orientativ",
        "Elemente practice: exercitii, studii de caz, instrumente de lucru",
        "Planificarea resurselor umane si materiale",
        "Calendarul activitatilor si livrabilelor",
        "Managementul riscurilor",
        "Asigurarea calitatii si raportarea finala",
      ],
      finalChecks: [
        "oferta semnata electronic",
        "atasamente sub limita recomandata de 15 MB pentru email",
        "pret ferm, fara actualizare",
        "fara oferta alternativa",
        "validitate oferta minimum 30 zile",
      ],
    },
    timeline: [
      { label: "Solicitari clarificari", due: "cu minimum 5 zile inainte de termenul limita", owner: "Responsabil oferta" },
      { label: "Depunere oferta", due: deadline, owner: "Responsabil oferta" },
      { label: "Kick-off dupa semnare", due: "maximum 5 zile de la ordinul de incepere", owner: "Coordonator contract" },
      { label: "Propunere continut instruiri", due: "lunile 2-3", owner: "Experti" },
      { label: "Livrare sesiuni", due: "lunile 4-6", owner: "Echipa experti" },
      { label: "Raport final", due: "luna 6", owner: "Coordonator contract" },
    ],
    warnings: [
      "Documentatia foloseste in unele locuri formularea echipa de 2 experti, dar cerinta de resurse si formula de punctaj indica 3 experti. Merita intrebare de clarificare.",
      "Punctajul maxim la experti se obtine doar cu dovezi clare pentru 7-10 sesiuni relevante per expert.",
      "Metodologia trebuie scrisa pe subfactorii 3.1 si 3.2, nu ca eseu frumos de pus in rama.",
    ],
  };
}

export function buildFormularConfigForTender(): FormularConfig {
  return {
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
          { id: "studii_detalii", label: "Studii relevante", type: "textarea", source: "standard", bind: "studii_detalii", required: true },
          { id: "are_cor_242401", label: "Detin certificat de Formator recunoscut national sau echivalent", type: "checkbox", source: "standard", bind: "are_cor_242401", required: true },
          { id: "bio", label: "Profil profesional scurt", type: "textarea", source: "standard", bind: "bio" },
        ],
      },
      {
        id: "expertiza-specifica",
        title: "Expertiza specifica pentru punctaj",
        description: "Aici masuram direct punctajul pentru expertul propus.",
        fields: [
          {
            id: "rol_expert",
            label: "Rol pentru care aplici",
            type: "select",
            source: "dynamic",
            required: true,
            options: [
              { value: "achizitii", label: "Expert achizitii publice" },
              { value: "proiecte", label: "Expert implementare proiecte cu finantare europeana" },
              { value: "dnsh", label: "Expert DNSH" },
            ],
          },
          {
            id: "sesiuni_relevante",
            label: "Numar sesiuni de instruire relevante dovedibile",
            type: "number",
            source: "dynamic",
            required: true,
            min: 0,
            scoring: { factorCod: "EXP", mode: "value" },
            help: "Pentru punctaj maxim sunt necesare 7-10 sesiuni relevante in achizitii publice / implementare proiecte / DNSH.",
          },
          {
            id: "experienta_detaliata",
            label: "Descriere experienta specifica",
            type: "textarea",
            source: "dynamic",
            required: true,
          },
        ],
      },
      {
        id: "contracte",
        title: "Contracte si experienta",
        description: "Adauga contracte, recomandari sau proiecte care sustin experienta declarata.",
        fields: [{ id: "contracte", label: "Contracte", type: "contract_list", required: true }],
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
}

export function buildExpertFactor() {
  return {
    cod: "EXP",
    denumire: "Experienta specifica formatori in sesiuni relevante",
    punctaj_max: 30,
    tip: "threshold_count" as const,
    agregare: "sum" as const,
    ordine: 1,
    config_json: {
      source: { scope: "dynamic", key: "sesiuni_relevante" },
      unit: "sesiuni",
      tiers: [
        { cutoff: 7, pts: 10, op: ">=" },
        { cutoff: 4, pts: 5, op: ">=" },
        { cutoff: 2, pts: 1, op: ">=" },
      ],
    },
  };
}

export function buildTechnicalProposalMarkdown(workspace: TenderWorkspace): string {
  const courseText = workspace.courses
    .map((course) => `### ${course.title}\n- Numar sesiuni: ${course.sessions}\n- Durata: ${course.daysPerSession} zi/zile per sesiune\n- Format: ${course.format}\n- Teme: ${course.keyTopics.join("; ")}\n- Elemente practice: ${course.practicalElements.join("; ")}`)
    .join("\n\n");

  return `# Propunere tehnica - ${workspace.identity.title}\n\n## 1. Intelegerea contextului\n${workspace.identity.sourceSummary}\n\nBeneficiar: ${workspace.identity.beneficiary}. Contractul urmareste dezvoltarea capacitatii institutiilor beneficiare de a implementa corect proiecte finantate prin PR Sud-Est 2021-2027.\n\n## 2. Obiectivul programului\nProgramul propus sprijina personalul institutiilor beneficiare printr-o abordare aplicata, construita in jurul achizitiilor publice, managementului proiectelor si principiului DNSH.\n\n## 3. Metodologia de implementare\n${workspace.methodology.implementationFlow.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## 4. Structura modulelor\n${courseText}\n\n## 5. Organizarea resurselor\nPrestatorul propune o echipa de 3 experti: expert achizitii publice, expert implementare proiecte cu finantare europeana si expert DNSH. Fiecare expert detine competente de formator si experienta specifica dovedita prin documente justificative.\n\n## 6. Managementul riscurilor\n${workspace.methodology.risks.map((item) => `- ${item.risk} Masura: ${item.mitigation}`).join("\n")}\n\n## 7. Asigurarea calitatii\n${workspace.methodology.qualityAssurance.map((item) => `- ${item}`).join("\n")}\n\n## 8. Livrabile\n- 9 sesiuni de instruire fizice;\n- materiale de formare digitale: prezentari, exercitii, studii de caz;\n- feedback dupa fiecare sesiune;\n- raport final de activitate.\n`;
}

function expertRole(id: string, title: string, domain: string): TenderExpertRole {
  return {
    id,
    title,
    domain,
    minimumRequirements: [
      "studii universitare relevante",
      "certificat Formator recunoscut national sau echivalent",
      `minimum 1 sesiune de instruire in domeniul ${domain}`,
    ],
    winningRequirements: [
      `7-10 sesiuni de instruire dovedibile in domeniul ${domain}`,
      "documente suport clare: contracte, recomandari, adeverinte sau livrabile",
      "disponibilitate pe toata durata contractului",
    ],
    requiredDocuments: ["CV semnat", "declaratie disponibilitate", "certificat formator", "diplome", "dovezi experienta specifica"],
  };
}

function normalize(value: string): string {
  return value
    .replace(/[ăâ]/gi, "a")
    .replace(/[î]/gi, "i")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .replace(/\s+/g, " ")
    .trim();
}

function includes(text: string, needle: string): boolean {
  return text.toLowerCase().includes(normalize(needle).toLowerCase());
}

function extractDeadline(text: string): string | null {
  const match = text.match(/(\d{2}\.\d{2}\.\d{4})\s*,?\s*ora\s*(\d{1,2}:\d{2})/i);
  return match ? `${match[1]}, ora ${match[2]}` : null;
}

function extractNumberBefore(text: string, marker: RegExp): number | null {
  const markerMatch = marker.exec(text);
  if (!markerMatch) return null;
  const before = text.slice(Math.max(0, markerMatch.index - 80), markerMatch.index);
  const numbers = before.match(/\d{2,3}(?:[\., ]\d{3})*(?:[\.,]\d+)?|\d+/g);
  const last = numbers?.at(-1);
  if (!last) return null;
  const parsed = Number(last.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstQuotedTitle(text: string): string | null {
  const match = text.match(/[„\"]([^„\"]{20,180})[”\"]/);
  return match?.[1]?.trim() ?? null;
}
