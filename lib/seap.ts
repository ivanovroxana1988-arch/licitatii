// lib/seap.ts
// Modul de descoperire licitații din e-licitatie.ro (SEAP).
// Trage anunțurile de participare DESCHISE, le potrivește pe codurile tale (CPV-first),
// și returnează o listă tipată. Fără dependențe externe (folosește fetch global).
//
// Endpoint-uri reverse-engineered:
//   listă anunțuri:    POST NoticeCommon/GetCNoticeList   (filtru startPublicationDate/endPublicationDate)
//   detaliu procedură: GET  PUBLICProcedure/GetProcedureView / GetProcedureEvaluationCriterias

const SEAP_BASE = "https://e-licitatie.ro/api-pub";
const LIST_URL = `${SEAP_BASE}/NoticeCommon/GetCNoticeList`;

const HEADERS = {
  "Content-Type": "application/json;charset=UTF-8",
  Accept: "application/json",
  Referer: "https://e-licitatie.ro/pub/notices/contract-notices/list/0/0",
  "User-Agent": "Mozilla/5.0 (licitatii-radar)",
};

// ——— configurare (poate fi mutată ulterior în Supabase / companie_profil) ———
export const RADAR_CONFIG = {
  lookbackDays: 21,
  pageSize: 50,
  maxPages: 40,
  requestDelayMs: 1200,
  onlyContractTypes: ["Servicii"] as string[],
  excludeStates: ["Atribuita", "Anulata", "Anulata partial"] as string[],
  cpvPrefixes: {
    formare: ["80000000", "8040", "805", "79632"],
    evenimente: ["7995"],
  } as Record<string, string[]>,
  strongPhrases: {
    formare: [
      "formare profesional", "servicii de formare", "curs de formare", "cursuri de formare",
      "perfectionare profesional", "calificare profesional", "recalificare", "reconversie profesional", "program de formare",
    ],
    evenimente: [
      "organizare de eveniment", "organizare eveniment", "organizarea evenimentelor",
      "organizare de seminar", "organizare de conferint", "organizare de congres",
      "servicii pentru evenimente", "organizare evenimente",
    ],
  } as Record<string, string[]>,
  boosterStems: {
    formare: ["instruire", "specializ", "training", "competent", "ucenicie"],
    evenimente: ["workshop", "atelier", "simpozion", "festival", "expozit", "congres"],
  } as Record<string, string[]>,
};

export interface SeapNotice {
  noticeNo: string;
  cNoticeId: number | null;
  procedureId: number | null;
  title: string;
  authority: string;
  cpv: string;
  cpvCode: string;
  value: number;
  currency: string;
  deadlineISO: string | null;
  deadlineText: string;
  daysLeft: number | null;
  state: string;
  contractType: string;
  line: string;          // "formare" | "evenimente" | ...
  via: "CPV" | "titlu";
  tags: string[];
  link: string;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasStem = (t: string, w: string) => new RegExp("\\b" + esc(norm(w))).test(t);
const hasPhrase = (t: string, p: string) => t.includes(norm(p));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RawItem = {
  cNoticeId?: number; procedureId?: number; noticeNo?: string;
  contractTitle?: string; contractingAuthorityNameAndFN?: string;
  cpvCodeAndName?: string; estimatedValueRon?: number; currencyCode?: string;
  maxTenderReceiptDeadline?: string; tenderReceiptDeadlineExport?: string;
  sysProcedureState?: { text?: string }; sysAcquisitionContractType?: { text?: string };
};

async function fetchPage(pageIndex: number, fromISO: string, toISO: string): Promise<{ items: RawItem[]; total: number }> {
  const res = await fetch(LIST_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ pageSize: RADAR_CONFIG.pageSize, pageIndex, startPublicationDate: fromISO, endPublicationDate: toISO }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SEAP HTTP ${res.status}`);
  const json = await res.json();
  return { items: Array.isArray(json.items) ? json.items : [], total: json.total ?? 0 };
}

function matchRaw(it: RawItem): Pick<SeapNotice, "line" | "via" | "tags" | "cpvCode"> | null {
  const title = norm(it.contractTitle);
  const cpvCode = (it.cpvCodeAndName?.match(/(\d{8})/) || [])[1] || "";
  const tags: string[] = [];
  let line: string | null = null;
  let via: "CPV" | "titlu" | null = null;

  for (const [k, prefixes] of Object.entries(RADAR_CONFIG.cpvPrefixes))
    if (prefixes.some((p) => cpvCode.startsWith(p))) { line = k; via = "CPV"; tags.push(`CPV ${k}`); break; }

  if (!line)
    for (const [k, phrases] of Object.entries(RADAR_CONFIG.strongPhrases))
      if (phrases.some((p) => hasPhrase(title, p))) { line = k; via = "titlu"; tags.push(`titlu ${k}`); break; }

  if (!line || !via) return null;
  if ((RADAR_CONFIG.boosterStems[line] ?? []).some((w) => hasStem(title, w))) tags.push("bonus");
  return { line, via, tags, cpvCode };
}

/** Descoperă licitațiile deschise relevante. Read-only — nu scrie nimic. */
export async function discoverNotices(): Promise<SeapNotice[]> {
  const now = new Date();
  const from = new Date(now.getTime() - RADAR_CONFIG.lookbackDays * 86_400_000);
  const fromISO = from.toISOString();
  const toISO = now.toISOString();

  const raw: RawItem[] = [];
  for (let page = 0; page < RADAR_CONFIG.maxPages; page++) {
    const { items, total } = await fetchPage(page, fromISO, toISO);
    raw.push(...items);
    if (raw.length >= total || items.length === 0) break;
    await sleep(RADAR_CONFIG.requestDelayMs);
  }

  const out: SeapNotice[] = [];
  for (const it of raw) {
    const state = it.sysProcedureState?.text ?? "";
    const ctype = it.sysAcquisitionContractType?.text ?? "";
    if (RADAR_CONFIG.excludeStates.includes(state)) continue;
    if (RADAR_CONFIG.onlyContractTypes.length && !RADAR_CONFIG.onlyContractTypes.includes(ctype)) continue;
    const m = matchRaw(it);
    if (!m) continue;

    const deadlineISO = it.maxTenderReceiptDeadline ?? null;
    const daysLeft = deadlineISO ? Math.ceil((new Date(deadlineISO).getTime() - Date.now()) / 86_400_000) : null;
    if (daysLeft != null && daysLeft < 0) continue; // doar deschise

    out.push({
      noticeNo: it.noticeNo ?? "",
      cNoticeId: it.cNoticeId ?? null,
      procedureId: it.procedureId ?? null,
      title: it.contractTitle ?? "",
      authority: it.contractingAuthorityNameAndFN ?? "",
      cpv: it.cpvCodeAndName ?? "",
      cpvCode: m.cpvCode,
      value: Number(it.estimatedValueRon) || 0,
      currency: it.currencyCode ?? "RON",
      deadlineISO,
      deadlineText: it.tenderReceiptDeadlineExport ?? "—",
      daysLeft,
      state,
      contractType: ctype,
      line: m.line,
      via: m.via,
      tags: m.tags,
      link: `https://e-licitatie.ro/pub/notices/c-notice/v2/view/${it.cNoticeId}`,
    });
  }

  out.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  return out;
}
