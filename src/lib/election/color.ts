import type { ColorMode, JoinedFeature, Party } from "./types";

export type RGB = { r: number; g: number; b: number };

export const DEM: RGB = { r: 0x1d, g: 0x4e, b: 0x89 };
export const GOP: RGB = { r: 0xb9, g: 0x1c, b: 0x2c };
export const PURPLE: RGB = { r: 0x6b, g: 0x3a, b: 0x78 };
export const OTHER: RGB = { r: 0x5f, g: 0x7a, b: 0x4a };
export const PAPER: RGB = { r: 0xf3, g: 0xee, b: 0xe4 };
export const NODATA: RGB = { r: 0xd9, g: 0xd3, b: 0xc9 };

export function parseHex(color: string): RGB {
  const hex = color.replace("#", "").trim();
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  return {
    r: parseInt(hex.slice(0, 2), 16) || 0,
    g: parseInt(hex.slice(2, 4), 16) || 0,
    b: parseInt(hex.slice(4, 6), 16) || 0,
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

function polarize(share: number, contrast: number) {
  const x = (share - 0.5) * 2;
  const c = Math.max(0.2, contrast);
  const y = Math.sign(x) * Math.pow(Math.abs(x), 1 / c);
  return 0.5 + y / 2;
}

export function blendRgb(gopShare: number, contrast: number, dem = DEM, gop = GOP, mid = PURPLE): RGB {
  const t = polarize(gopShare, contrast);
  if (t < 0.5) return lerpRgb(dem, mid, t * 2);
  return lerpRgb(mid, gop, (t - 0.5) * 2);
}

export function featureColor(
  feature: JoinedFeature,
  mode: ColorMode,
  contrast: number,
  parties: Party[],
): string {
  if (!feature.hasData || feature.total <= 0) return rgbToHex(NODATA);

  const demParty = parties.find((p) => p.id === "dem");
  const gopParty = parties.find((p) => p.id === "gop");
  const dem = demParty ? parseHex(demParty.color) : DEM;
  const gop = gopParty ? parseHex(gopParty.color) : GOP;
  const mid = lerpRgb(dem, gop, 0.5);
  mid.r = (mid.r + PURPLE.r) / 2;
  mid.g = (mid.g + PURPLE.g) / 2;
  mid.b = (mid.b + PURPLE.b) / 2;

  const two = feature.dem + feature.gop;
  const gopShare = two > 0 ? feature.gop / two : 0.5;
  const otherShare = feature.oth / feature.total;

  if (mode === "winner") {
    if (feature.dem === feature.gop) return rgbToHex(PURPLE);
    const win = feature.dem > feature.gop ? dem : gop;
    return rgbToHex(win);
  }

  let color = blendRgb(gopShare, contrast, dem, gop, mid);

  if (mode === "margin") {
    const margin = Math.abs(gopShare - 0.5) * 2;
    const sat = 0.22 + 0.78 * Math.pow(margin, 0.65);
    color = lerpRgb(PAPER, color, sat);
  }

  if (otherShare > 0.02) {
    color = lerpRgb(color, OTHER, Math.min(0.35, otherShare * 0.8));
  }

  return rgbToHex(color);
}

export function legendStops(mode: ColorMode, contrast: number): { offset: number; color: string }[] {
  const shares = [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1];
  return shares.map((gopShare) => {
    const fake: JoinedFeature = {
      id: "",
      name: "",
      path: "",
      centroid: null,
      dem: Math.round((1 - gopShare) * 1000),
      gop: Math.round(gopShare * 1000),
      oth: 0,
      total: 1000,
      inherited: false,
      hasData: true,
    };
    return { offset: gopShare, color: featureColor(fake, mode, contrast, []) };
  });
}
