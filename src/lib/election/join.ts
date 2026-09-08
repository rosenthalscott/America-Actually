import type { JoinedFeature, PreparedFeature, ResultRow } from "./types";

function pad(id: string, width: number) {
  return id.replace(/\D/g, "").padStart(width, "0");
}

export function buildResultIndex(rows: ResultRow[]): Map<string, ResultRow> {
  const map = new Map<string, ResultRow>();
  for (const row of rows) {
    const id = String(row.id);
    map.set(id, row);
    map.set(id.toLowerCase(), row);
    const digits = id.replace(/\D/g, "");
    if (digits) {
      map.set(digits, row);
      map.set(pad(digits, 2), row);
      map.set(pad(digits, 5), row);
    }
  }
  return map;
}

export function lookupResult(
  featureId: string,
  name: string,
  index: Map<string, ResultRow>,
): { row: ResultRow; inherited: boolean } | null {
  const id = String(featureId);
  const direct =
    index.get(id) ??
    index.get(id.toLowerCase()) ??
    index.get(id.replace(/\D/g, "")) ??
    index.get(pad(id, 5)) ??
    index.get(pad(id, 2)) ??
    (name ? index.get(name.toLowerCase()) : undefined);
  if (direct) return { row: direct, inherited: false };

  const digits = id.replace(/\D/g, "");
  if (digits.length >= 5) {
    const state = pad(digits.slice(0, 2), 2);
    const parent = index.get(state);
    if (parent) return { row: parent, inherited: true };
  }
  return null;
}

export function joinFeatures(features: PreparedFeature[], rows: ResultRow[]): JoinedFeature[] {
  const index = buildResultIndex(rows);
  return features.map((feature) => {
    const found = lookupResult(feature.id, feature.name, index);
    if (!found) {
      return {
        ...feature,
        dem: 0,
        gop: 0,
        oth: 0,
        total: 0,
        inherited: false,
        hasData: false,
      };
    }
    const { row, inherited } = found;
    const dem = row.dem || 0;
    const gop = row.gop || 0;
    const oth = row.oth || 0;
    return {
      ...feature,
      name: feature.name || row.name,
      dem,
      gop,
      oth,
      total: dem + gop + oth,
      inherited,
      hasData: dem + gop + oth > 0,
    };
  });
}
