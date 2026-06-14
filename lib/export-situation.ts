import {
  isEligible,
  pointsForFormator,
  rawValueForFactor,
  type Criteriu,
  type Factor,
  type Formator,
} from "@/lib/scoring";

export type SituationLicitatie = {
  id: string;
  nume: string;
  referinta?: string | null;
  beneficiar?: string | null;
};

export type SituationAplicare = {
  id: string;
  status: string;
  selectat: boolean;
  token: string;
  raspunsuri_formular_json?: Record<string, unknown> | null;
  formator: {
    id: string;
    nume?: string | null;
    prenume?: string | null;
    email?: string | null;
    telefon?: string | null;
    domeniu_studii?: string | null;
    studii_detalii?: string | null;
    are_cor_242401?: boolean | null;
    ani_management?: number | null;
    bio?: string | null;
  } | null;
  contracte: SituationContract[];
};

export type SituationContract = {
  organizatie?: string | null;
  domeniu_org?: string | null;
  structura_complexa?: boolean | null;
  perioada?: string | null;
  ore?: number | null;
  tematici?: string | null;
  nr_tematici?: number | null;
};

export function buildSituationCsv(params: {
  licitatie: SituationLicitatie;
  aplicari: SituationAplicare[];
  factori: Factor[];
  criterii: Criteriu[];
}) {
  const factorHeaders = params.factori.flatMap((factor) => [
    `${factor.cod} valoare`,
    `${factor.cod} puncte`,
  ]);
  const headers = [
    "Licitatie",
    "Referinta",
    "Beneficiar",
    "Aplicare ID",
    "Status",
    "Selectat",
    "Eligibil",
    "Observatii eligibilitate",
    "Formator",
    "Email",
    "Telefon",
    "Domeniu studii",
    "Certificat COR 242401",
    "Ani management",
    "Nr. contracte",
    "Organizatii",
    "Structuri complexe",
    "Total ore",
    "Max tematici/contract",
    "Tematici",
    "Raspunsuri formular",
    ...factorHeaders,
  ];

  const rows = params.aplicari.map((row) => {
    const formator = toScoringFormator(row);
    const eligibility = row.formator
      ? isEligible(formator, params.criterii, params.factori)
      : { ok: false, details: [{ eticheta: "Formator necompletat", ok: false }] };
    const totalHours = row.contracte.reduce((sum, contract) => sum + Number(contract.ore ?? 0), 0);
    const complexCount = row.contracte.filter((contract) => !!contract.structura_complexa).length;
    const maxTopics = Math.max(0, ...row.contracte.map((contract) => Number(contract.nr_tematici ?? 0)));
    const topics = uniqueList(
      row.contracte.flatMap((contract) =>
        String(contract.tematici ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

    return [
      params.licitatie.nume,
      params.licitatie.referinta ?? "",
      params.licitatie.beneficiar ?? "",
      row.id,
      statusLabel(row.status),
      row.selectat ? "Da" : "Nu",
      eligibility.ok ? "Da" : "Nu",
      eligibility.details.filter((detail) => !detail.ok).map((detail) => detail.eticheta).join("; "),
      formatName(row.formator?.prenume, row.formator?.nume) || "Formator invitat",
      row.formator?.email ?? "",
      row.formator?.telefon ?? "",
      row.formator?.domeniu_studii ?? "",
      row.formator?.are_cor_242401 ? "Da" : "Nu",
      String(Number(row.formator?.ani_management ?? 0)),
      String(row.contracte.length),
      row.contracte.map((contract) => contract.organizatie).filter(Boolean).join("; "),
      String(complexCount),
      String(totalHours),
      String(maxTopics),
      topics.join("; "),
      row.raspunsuri_formular_json ? JSON.stringify(row.raspunsuri_formular_json) : "",
      ...params.factori.flatMap((factor) => [
        formatRawValue(rawValueForFactor(factor, formator)),
        String(pointsForFormator(factor, formator)),
      ]),
    ];
  });

  return toCsv([headers, ...rows]);
}

export function buildSituationFilename(licitatie: SituationLicitatie) {
  const label = licitatie.referinta || licitatie.nume || "licitatie";
  return `${slugify(`situatie-${label}`)}.csv`;
}

function toScoringFormator(row: SituationAplicare): Formator {
  return {
    id: row.formator?.id ?? row.id,
    nume: row.formator?.nume ?? "",
    prenume: row.formator?.prenume ?? "",
    domeniu_studii: row.formator?.domeniu_studii ?? "",
    are_cor_242401: !!row.formator?.are_cor_242401,
    raspunsuri_formular_json: row.raspunsuri_formular_json ?? {},
    contracte: row.contracte.map((contract) => ({
      organizatie: contract.organizatie ?? "",
      structura_complexa: !!contract.structura_complexa,
      ore: Number(contract.ore ?? 0),
      nr_tematici: Number(contract.nr_tematici ?? 0),
    })),
  };
}

function toCsv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(";")).join("\r\n")}\r\n`;
}

function escapeCell(value: string) {
  const text = String(value ?? "");
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatName(prenume?: string | null, nume?: string | null) {
  return [prenume, nume].map((part) => part?.trim()).filter(Boolean).join(" ");
}

function statusLabel(status: string) {
  if (status === "finalizat") return "Finalizat";
  if (status === "in_completare") return "In completare";
  return "Invitat";
}

function formatRawValue(value: number | string | boolean) {
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  return value || "-";
}

function uniqueList(values: string[]) {
  return [...new Set(values)];
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "situatie-licitatie";
}
