import { useMemo } from "react";
import { legendStops } from "@/lib/election/color";
import type { ColorMode } from "@/lib/election/types";

export function MapLegend({
  mode,
  contrast,
  demLabel,
  gopLabel,
}: {
  mode: ColorMode;
  contrast: number;
  demLabel: string;
  gopLabel: string;
}) {
  const stops = useMemo(() => legendStops(mode, contrast), [mode, contrast]);
  const gradient = stops.map((s) => `${s.color} ${s.offset * 100}%`).join(", ");

  const caption =
    mode === "winner"
      ? "Solid color of whoever finished first"
      : mode === "margin"
        ? "Pale where the race was close"
        : "Mix of both colors by vote share";

  return (
    <div className="pointer-events-none max-w-xs">
      <div className="flex items-baseline justify-between gap-3 text-[11px] font-medium tracking-wide text-muted-foreground">
        <span className="text-dem">{demLabel}</span>
        <span className="text-gop">{gopLabel}</span>
      </div>
      <div
        className="mt-1 h-2 w-full rounded-full"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
        aria-hidden
      />
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{caption}</p>
    </div>
  );
}
