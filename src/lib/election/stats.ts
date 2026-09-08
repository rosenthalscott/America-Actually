import type { JoinedFeature, Party, ResultRow } from "./types";

export type NationalStats = {
  dem: number;
  gop: number;
  oth: number;
  total: number;
  units: number;
  withData: number;
  demWins: number;
  gopWins: number;
  ties: number;
  close: number;
};

export const EMPTY_STATS: NationalStats = {
  dem: 0,
  gop: 0,
  oth: 0,
  total: 0,
  units: 0,
  withData: 0,
  demWins: 0,
  gopWins: 0,
  ties: 0,
  close: 0,
};

function tally(
  stats: NationalStats,
  dem: number,
  gop: number,
  oth: number,
  countUnit: boolean,
) {
  const total = dem + gop + oth;
  if (total <= 0) return;
  if (countUnit) stats.withData += 1;
  stats.dem += dem;
  stats.gop += gop;
  stats.oth += oth;
  stats.total += total;
  if (dem === gop) stats.ties += 1;
  else if (dem > gop) stats.demWins += 1;
  else stats.gopWins += 1;
  const two = dem + gop;
  if (two > 0 && Math.abs(dem / two - 0.5) <= 0.05) stats.close += 1;
}

export function summarize(features: JoinedFeature[]): NationalStats {
  const stats: NationalStats = { ...EMPTY_STATS, units: features.length };
  const seenInherited = new Set<string>();

  for (const f of features) {
    if (!f.hasData) continue;
    if (f.inherited) {
      const key = f.id.replace(/\D/g, "").slice(0, 2);
      if (seenInherited.has(key)) continue;
      seenInherited.add(key);
    }
    tally(stats, f.dem, f.gop, f.oth, !f.inherited);
  }

  if (stats.withData === 0) {
    stats.withData = features.filter((f) => f.hasData).length;
  }

  return stats;
}

export function summarizeRows(rows: ResultRow[]): NationalStats {
  const stats: NationalStats = { ...EMPTY_STATS, units: rows.length };
  for (const row of rows) {
    tally(stats, row.dem || 0, row.gop || 0, row.oth || 0, true);
  }
  return stats;
}

export function partyById(parties: Party[], id: string): Party | undefined {
  return parties.find((p) => p.id === id);
}
