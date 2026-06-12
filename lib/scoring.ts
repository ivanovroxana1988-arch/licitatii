export type Tier = { cutoff: number; pts: number; op: ">" | ">=" };
export type DomainItem = { key: string; label: string; pts: number };

export type FactorSource = {
  scope:
    | "formator"
    | "dynamic"
    | "contract_count_complex"
    | "contract_hours_sum"
    | "contract_topics_max";
  key?: string;
};

export type Factor = {
  id: string;
  cod: string;
  denumire: string;
  punctaj_max: number;
  tip: "threshold_value" | "threshold_count" | "domain_map";
  agregare: "max" | "avg" | "sum";
  config_json: {
    tiers?: Tier[];
    map?: DomainItem[];
    unit?: string;
    source?: FactorSource;
  };
};

export type Criteriu = {
  id: string;
  eticheta: string;
  tip: "bool" | "min_factor";
  factor_cod?: string | null;
  valoare_min?: number | null;
};

export type Contract = {
  organizatie: string;
  structura_complexa: boolean;
  ore: number;
  nr_tematici: number;
};

export type Formator = {
  id: string;
  nume?: string;
  prenume?: string;
  domeniu_studii?: string;
  are_cor_242401?: boolean;
  raspunsuri_formular_json?: Record<string, unknown>;
  contracte: Contract[];
};

function scoreTiers(value: number, tiers: Tier[] = []): number {
  for (const t of tiers) {
    if (t.op === ">" ? value > t.cutoff : value >= t.cutoff) return t.pts;
  }
  return 0;
}

export function rawValueForFactor(factor: Factor, f: Formator): number | string | boolean {
  const configured = rawValueFromConfiguredSource(factor, f);
  if (configured !== null) return configured;

  if (factor.tip === "domain_map") return f.domeniu_studii ?? "";
  if (factor.cod === "F2.2") {
    return f.contracte.filter((c) => c.structura_complexa).length;
  }
  if (factor.cod === "F2.3") {
    return f.contracte.reduce((a, c) => a + (Number(c.ore) || 0), 0);
  }
  if (factor.cod === "F2.4") {
    return Math.max(0, ...f.contracte.map((c) => Number(c.nr_tematici) || 0));
  }

  return 0;
}

export function pointsForFormator(factor: Factor, f: Formator): number {
  if (factor.tip === "domain_map") {
    const value = String(rawValueForFactor(factor, f) ?? "");
    const item = factor.config_json.map?.find((m) => m.key === value);
    return item ? item.pts : 0;
  }

  const value = Number(rawValueForFactor(factor, f)) || 0;
  return scoreTiers(value, factor.config_json.tiers);
}

export function factorScore(factor: Factor, formators: Formator[]): number {
  const per = formators.map((f) => pointsForFormator(factor, f));
  if (!per.length) return 0;

  let agg: number;
  if (factor.agregare === "avg") agg = per.reduce((a, b) => a + b, 0) / per.length;
  else if (factor.agregare === "sum") agg = per.reduce((a, b) => a + b, 0);
  else agg = Math.max(...per);

  return Math.round(agg * 100) / 100;
}

export function technicalTotal(factors: Factor[], formators: Formator[]): number {
  const total = factors.reduce((a, f) => a + factorScore(f, formators), 0);
  return Math.round(total * 100) / 100;
}

export function isEligible(
  f: Formator,
  criterii: Criteriu[],
  factors: Factor[]
): { ok: boolean; details: { eticheta: string; ok: boolean }[] } {
  const details = criterii.map((c) => {
    if (c.tip === "bool") {
      return { eticheta: c.eticheta, ok: !!f.are_cor_242401 };
    }

    const factor = factors.find((x) => x.cod === c.factor_cod);
    const value = factor ? Number(rawValueForFactor(factor, f)) || 0 : 0;
    return { eticheta: c.eticheta, ok: value >= (c.valoare_min ?? 0) };
  });

  return { ok: details.every((d) => d.ok), details };
}

export function priceScore(myPrice: number, compPrice: number, maxPts: number): number {
  if (!myPrice) return 0;
  const pmin = Math.min(myPrice, compPrice || myPrice);
  return Math.round((pmin / myPrice) * maxPts * 100) / 100;
}

function rawValueFromConfiguredSource(
  factor: Factor,
  f: Formator
): number | string | boolean | null {
  const source = factor.config_json.source;
  if (!source) return null;

  if (source.scope === "dynamic" && source.key) {
    const value = f.raspunsuri_formular_json?.[source.key];
    return normalizeRawValue(value);
  }

  if (source.scope === "formator" && source.key) {
    const value = f[source.key as keyof Formator];
    return normalizeRawValue(value);
  }

  if (source.scope === "contract_count_complex") {
    return f.contracte.filter((c) => c.structura_complexa).length;
  }

  if (source.scope === "contract_hours_sum") {
    return f.contracte.reduce((total, c) => total + (Number(c.ore) || 0), 0);
  }

  if (source.scope === "contract_topics_max") {
    return Math.max(0, ...f.contracte.map((c) => Number(c.nr_tematici) || 0));
  }

  return null;
}

function normalizeRawValue(value: unknown): number | string | boolean {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  return 0;
}
