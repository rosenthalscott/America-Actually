import type { ElectionPayload, GeoLevel, GeographySpec } from "./types";

export const YEARS = [2008, 2012, 2016, 2020, 2024] as const;
export type Year = (typeof YEARS)[number];

export const GEOGRAPHIES: Record<string, GeographySpec> = {
  "us-counties": {
    id: "us-counties",
    title: "U.S. Counties",
    url: "/data/geo/us-10m.json",
    format: "topojson",
    object: "counties",
    idProperty: "id",
    nameProperty: "name",
    projection: "albersUsa",
    useMesh: true,
  },
  "us-states": {
    id: "us-states",
    title: "U.S. States",
    url: "/data/geo/us-10m.json",
    format: "topojson",
    object: "states",
    idProperty: "id",
    nameProperty: "name",
    projection: "albersUsa",
    useMesh: true,
  },
  "harbor-city": {
    id: "harbor-city",
    title: "Harbor City",
    url: "/data/geo/harbor-city.json",
    format: "geojson",
    idProperty: "id",
    nameProperty: "name",
    projection: "fit",
    useMesh: false,
  },
};

export function isYear(n: number): n is Year {
  return (YEARS as readonly number[]).includes(n);
}

export function builtinElectionUrl(year: Year, level: GeoLevel): string {
  return `/data/elections/${year}-president-${level}.json`;
}

export function geographyForLevel(level: GeoLevel): GeographySpec {
  return level === "states" ? GEOGRAPHIES["us-states"] : GEOGRAPHIES["us-counties"];
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadBuiltinElection(year: Year, level: GeoLevel): Promise<ElectionPayload> {
  return fetchJson<ElectionPayload>(builtinElectionUrl(year, level));
}

export const HARBOR_CITY_ID = "harbor-city-council";

export async function loadHarborCity(): Promise<ElectionPayload> {
  return fetchJson<ElectionPayload>("/data/elections/harbor-city-council.json");
}

const topoCache = new Map<string, unknown>();
const geojsonCache = new Map<string, unknown>();

export async function loadGeography(spec: GeographySpec): Promise<unknown> {
  const cache = spec.format === "topojson" ? topoCache : geojsonCache;
  const hit = cache.get(spec.url);
  if (hit) return hit;
  const data = await fetchJson(spec.url);
  cache.set(spec.url, data);
  return data;
}
