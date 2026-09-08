import { geoAlbersUsa, geoBounds, geoCentroid, geoIdentity, geoMercator, geoPath } from "d3-geo";
import { feature as topoFeature, mesh as topoMesh } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { GeographySpec, MapMeshes, PreparedFeature } from "./types";

const PAD = 16;

type AnyFeat = Feature<Geometry, Record<string, unknown>>;

function featureId(feat: AnyFeat, spec: GeographySpec, fallbackIndex: number): string {
  const raw =
    feat.id ??
    feat.properties?.[spec.idProperty] ??
    feat.properties?.id ??
    feat.properties?.GEOID ??
    feat.properties?.geoid ??
    feat.properties?.FIPS ??
    feat.properties?.fips ??
    fallbackIndex;
  return String(raw);
}

function featureName(feat: AnyFeat, spec: GeographySpec, id: string): string {
  const props = feat.properties ?? {};
  const raw =
    props[spec.nameProperty] ??
    props.name ??
    props.NAME ??
    props.NAMELSAD ??
    props.title ??
    id;
  return String(raw);
}

export function asFeatureCollection(data: unknown, spec: GeographySpec): FeatureCollection {
  if (
    data &&
    typeof data === "object" &&
    (data as { type?: string }).type === "FeatureCollection" &&
    Array.isArray((data as FeatureCollection).features)
  ) {
    return data as FeatureCollection;
  }

  if (data && typeof data === "object" && (data as { type?: string }).type === "Topology") {
    const topo = data as Topology;
    const objectName =
      spec.object && topo.objects[spec.object]
        ? spec.object
        : Object.keys(topo.objects).find((k) => {
            const obj = topo.objects[k];
            return obj && obj.type === "GeometryCollection";
          });
    if (!objectName) throw new Error("No geometry object in TopoJSON");
    const fc = topoFeature(topo, topo.objects[objectName]) as unknown as FeatureCollection;
    return fc;
  }

  if (data && typeof data === "object" && (data as { type?: string }).type === "Feature") {
    return { type: "FeatureCollection", features: [data as Feature] };
  }

  throw new Error("Upload a GeoJSON FeatureCollection or a TopoJSON topology");
}

function fitFeature(data: unknown, fc: FeatureCollection): FeatureCollection | Feature {
  if (data && typeof data === "object" && (data as { type?: string }).type === "Topology") {
    const topo = data as Topology;
    if (topo.objects.nation) {
      return topoFeature(topo, topo.objects.nation) as unknown as Feature;
    }
    if (topo.objects.states) {
      return topoFeature(topo, topo.objects.states) as unknown as FeatureCollection;
    }
  }
  return fc;
}

function pickProjection(
  data: unknown,
  fc: FeatureCollection,
  width: number,
  height: number,
  prefer: GeographySpec["projection"],
) {
  const extent: [[number, number], [number, number]] = [
    [PAD, PAD],
    [Math.max(PAD + 10, width - PAD), Math.max(PAD + 10, height - PAD)],
  ];

  const subject = prefer === "albersUsa" ? fitFeature(data, fc) : fc;

  if (prefer === "albersUsa") {
    return geoAlbersUsa().fitExtent(extent, subject);
  }

  const [[minX, minY], [maxX, maxY]] = geoBounds(fc);
  const geographic = minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90 && maxX - minX > 0.2;

  if (geographic) {
    const looksUS = minX < -66 && maxX < -50 && minY > 15 && maxY < 80;
    if (looksUS) return geoAlbersUsa().fitExtent(extent, fitFeature(data, fc));
    return geoMercator().fitExtent(extent, fc);
  }

  return geoIdentity().reflectY(true).fitExtent(extent, fc);
}

function meshesFromTopo(
  data: unknown,
  spec: GeographySpec,
  path: ReturnType<typeof geoPath>,
): MapMeshes {
  if (!data || (data as { type?: string }).type !== "Topology") return {};
  const topo = data as Topology;
  const meshes: MapMeshes = {};
  const unitName = spec.object && topo.objects[spec.object] ? spec.object : undefined;
  if (unitName) {
    try {
      meshes.units = path(topoMesh(topo, topo.objects[unitName] as GeometryCollection, (a, b) => a !== b)) ?? undefined;
    } catch {
      /* ignore */
    }
  }
  if (topo.objects.states) {
    try {
      meshes.states = path(topoMesh(topo, topo.objects.states as GeometryCollection, (a, b) => a !== b)) ?? undefined;
    } catch {
      /* ignore */
    }
  }
  if (topo.objects.nation) {
    try {
      meshes.outline = path(topoMesh(topo, topo.objects.nation as GeometryCollection)) ?? undefined;
    } catch {
      /* ignore */
    }
  }
  return meshes;
}

export function prepareMap(
  data: unknown,
  spec: GeographySpec,
  width: number,
  height: number,
): { features: PreparedFeature[]; meshes: MapMeshes } {
  if (width < 8 || height < 8) return { features: [], meshes: {} };

  const fc = asFeatureCollection(data, spec);
  const projection = pickProjection(data, fc, width, height, spec.projection);
  const path = geoPath(projection);

  const features: PreparedFeature[] = fc.features.map((raw, i) => {
    const feat = raw as AnyFeat;
    const id = featureId(feat, spec, i);
    const d = path(feat) ?? "";
    const c = geoCentroid(feat);
    const projected = Number.isFinite(c[0]) && Number.isFinite(c[1]) ? projection(c) : null;
    const centroid =
      projected && Number.isFinite(projected[0]) && Number.isFinite(projected[1])
        ? ([projected[0], projected[1]] as [number, number])
        : null;
    return { id, name: featureName(feat, spec, id), path: d, centroid };
  });

  const meshes = spec.useMesh ? meshesFromTopo(data, spec, path) : {};
  return { features, meshes };
}
