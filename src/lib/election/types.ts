export type PartyId = string;

export type Party = {
  id: PartyId;
  label: string;
  shortLabel: string;
  color: string;
};

export type ResultRow = {
  id: string;
  name: string;
  dem: number;
  gop: number;
  oth: number;
};

export type ElectionPayload = {
  id: string;
  title: string;
  subtitle?: string;
  year?: number;
  office?: string;
  geographyId: string;
  parties: Party[];
  source?: string;
  notes?: string;
  rows: ResultRow[];
  custom?: boolean;
};

export type GeographySpec = {
  id: string;
  title: string;
  url: string;
  format: "topojson" | "geojson";
  object?: string;
  idProperty: string;
  nameProperty: string;
  projection: "albersUsa" | "fit";
  useMesh?: boolean;
};

export type ColorMode = "blend" | "winner" | "margin";

export type GeoLevel = "counties" | "states";

export type PreparedFeature = {
  id: string;
  name: string;
  path: string;
  centroid: [number, number] | null;
};

export type JoinedFeature = PreparedFeature & {
  dem: number;
  gop: number;
  oth: number;
  total: number;
  inherited: boolean;
  hasData: boolean;
};

export type MapMeshes = {
  units?: string;
  states?: string;
  outline?: string;
};
