import Papa from "papaparse";
import { asFeatureCollection } from "./geo";
import type { ElectionPayload, GeographySpec, Party, ResultRow } from "./types";

const DEM_KEYS = ["dem", "democrat", "democratic", "votes_dem", "harris", "biden", "obama", "clinton", "blue", "left", "party_a", "coalition"];
const GOP_KEYS = ["gop", "rep", "republican", "votes_gop", "trump", "mccain", "romney", "red", "right", "party_b", "civic"];
const OTH_KEYS = ["oth", "other", "votes_oth", "others", "indie", "independent", "third"];
const ID_KEYS = ["id", "fips", "geoid", "geo_id", "combined_fips", "county_fips", "state_fips", "district_id", "code"];
const NAME_KEYS = ["name", "county_name", "county", "state", "state_name", "district", "title", "label"];

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function pickKey(keys: string[], candidates: string[]): string | undefined {
  const set = new Map(keys.map((k) => [norm(k), k]));
  for (const c of candidates) {
    const hit = set.get(c);
    if (hit) return hit;
  }
  return undefined;
}

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export type ColumnMapping = {
  id?: string;
  name?: string;
  dem?: string;
  gop?: string;
  oth?: string;
};

export function detectColumns(headers: string[]): ColumnMapping {
  return {
    id: pickKey(headers, ID_KEYS),
    name: pickKey(headers, NAME_KEYS),
    dem: pickKey(headers, DEM_KEYS),
    gop: pickKey(headers, GOP_KEYS),
    oth: pickKey(headers, OTH_KEYS),
  };
}

export function rowsFromObjects(objects: Record<string, unknown>[], mapping: ColumnMapping): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const obj of objects) {
    const id = mapping.id ? String(obj[mapping.id] ?? "").trim() : "";
    if (!id) continue;
    const name = mapping.name ? String(obj[mapping.name] ?? id) : id;
    rows.push({
      id,
      name,
      dem: mapping.dem ? toNum(obj[mapping.dem]) : 0,
      gop: mapping.gop ? toNum(obj[mapping.gop]) : 0,
      oth: mapping.oth ? toNum(obj[mapping.oth]) : 0,
    });
  }
  return rows;
}

export function parseCsv(text: string): { headers: string[]; objects: Record<string, unknown>[] } {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const headers = parsed.meta.fields ?? [];
  return { headers, objects: parsed.data.filter((row) => row && typeof row === "object") };
}

export function parseResultsJson(data: unknown): { headers: string[]; objects: Record<string, unknown>[] } {
  if (Array.isArray(data)) {
    const objects = data.filter((d) => d && typeof d === "object") as Record<string, unknown>[];
    const headers = objects[0] ? Object.keys(objects[0]) : [];
    return { headers, objects };
  }
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.rows)) {
      const objects = rec.rows as Record<string, unknown>[];
      const headers = objects[0] ? Object.keys(objects[0]) : ["id", "name", "dem", "gop", "oth"];
      return { headers, objects };
    }
  }
  throw new Error("Results JSON should be an array of { id, name, dem, gop, oth }");
}

function votesFromProps(props: Record<string, unknown>): { dem: number; gop: number; oth: number } | null {
  const mapping = detectColumns(Object.keys(props));
  if (!mapping.dem && !mapping.gop) return null;
  return {
    dem: mapping.dem ? toNum(props[mapping.dem]) : 0,
    gop: mapping.gop ? toNum(props[mapping.gop]) : 0,
    oth: mapping.oth ? toNum(props[mapping.oth]) : 0,
  };
}

export function resultsFromGeojson(data: unknown, spec: GeographySpec): ResultRow[] | null {
  const fc = asFeatureCollection(data, spec);
  const rows: ResultRow[] = [];
  for (let i = 0; i < fc.features.length; i++) {
    const feat = fc.features[i];
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const votes = votesFromProps(props);
    if (!votes) return null;
    const id = String(feat.id ?? props[spec.idProperty] ?? props.id ?? i);
    const name = String(props[spec.nameProperty] ?? props.name ?? id);
    rows.push({ id, name, ...votes });
  }
  return rows.length ? rows : null;
}

export const DEFAULT_PARTIES: Party[] = [
  { id: "dem", label: "Democrat", shortLabel: "D", color: "#1D4E89" },
  { id: "gop", label: "Republican", shortLabel: "R", color: "#B91C2C" },
  { id: "oth", label: "Other", shortLabel: "O", color: "#5F7A4A" },
];

export function makeCustomPayload(input: {
  title: string;
  geographyId: string;
  rows: ResultRow[];
  parties?: Party[];
  source?: string;
}): ElectionPayload {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return {
    id: `custom-${slug || "map"}-${Date.now().toString(36)}`,
    title: input.title || "Custom election",
    subtitle: "Plugged in",
    geographyId: input.geographyId,
    parties: input.parties ?? DEFAULT_PARTIES,
    source: input.source ?? "Uploaded in this session",
    rows: input.rows,
    custom: true,
  };
}

export async function readFileText(file: File): Promise<string> {
  return file.text();
}

export function looksLikeGeography(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const t = (data as { type?: string }).type;
  if (t === "FeatureCollection" || t === "Topology" || t === "Feature") return true;
  return false;
}
