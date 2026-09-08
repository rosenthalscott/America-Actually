import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { JoinedFeature, MapMeshes } from "@/lib/election/types";
import { formatInt, formatPct } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Transform = { x: number; y: number; k: number };

const PathLayer = memo(function PathLayer({
  features,
  colors,
  stroke,
}: {
  features: JoinedFeature[];
  colors: Record<string, string>;
  stroke: boolean;
}) {
  return (
    <g>
      {features.map((f) =>
        f.path ? (
          <path
            key={f.id}
            data-id={f.id}
            d={f.path}
            className="map-region"
            fill={colors[f.id] ?? "var(--color-map-nodata)"}
            stroke={stroke ? "var(--color-background)" : "none"}
            strokeWidth={stroke ? 0.75 : 0}
            strokeLinejoin="round"
          />
        ) : null,
      )}
    </g>
  );
});

type Tip = {
  id: string;
  x: number;
  y: number;
};

export function ElectionMap({
  features,
  meshes,
  colors,
  selectedId,
  onSelect,
  showLabels = false,
  useMesh = true,
  parties,
  width,
  height,
}: {
  features: JoinedFeature[];
  meshes: MapMeshes;
  colors: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showLabels?: boolean;
  useMesh?: boolean;
  parties: { dem: string; gop: string };
  width: number;
  height: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [tip, setTip] = useState<Tip | null>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    orig: Transform;
    moved: boolean;
    hitId: string | null;
  } | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, JoinedFeature>();
    for (const f of features) m.set(f.id, f);
    return m;
  }, [features]);

  const hovered = tip ? byId.get(tip.id) : undefined;
  const selected = selectedId ? byId.get(selectedId) : undefined;

  const reset = useCallback(() => setTransform({ x: 0, y: 0, k: 1 }), []);

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setTransform((t) => {
      const k = Math.max(1, Math.min(18, t.k * factor));
      const nx = cx - ((cx - t.x) * k) / t.k;
      const ny = cy - ((cy - t.y) * k) / t.k;
      return { x: nx, y: ny, k };
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const hitId = (e.target as Element).getAttribute?.("data-id");
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      orig: transform,
      moved: false,
      hitId,
    };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    const idFromTarget = target.getAttribute?.("data-id");
    const id = idFromTarget ?? (drag.current && !drag.current.moved ? drag.current.hitId : null);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (id && rect) {
      setTip({ id, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else if (!drag.current) {
      setTip(null);
    }

    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 4) drag.current.moved = true;
    if (drag.current.moved) {
      setTransform({
        x: drag.current.orig.x + dx,
        y: drag.current.orig.y + dy,
        k: drag.current.orig.k,
      });
    }
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!d || d.moved) return;
    if (d.hitId) onSelect(d.hitId === selectedId ? null : d.hitId);
    else onSelect(null);
  };

  const onLeave = () => {
    if (!drag.current) setTip(null);
  };

  const labels = showLabels
    ? features.filter((f) => f.centroid && f.path && f.name)
    : [];

  return (
    <div ref={wrapRef} className="relative h-full min-h-0 w-full overflow-hidden">
      <svg
        className="block h-full w-full touch-none select-none"
        viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Election map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onLeave}
        onDoubleClick={(e) => {
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return;
          zoomAt(e.clientX - rect.left, e.clientY - rect.top, 1.6);
        }}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          <PathLayer features={features} colors={colors} stroke={!useMesh} />
          {useMesh && meshes.units ? (
            <path
              d={meshes.units}
              fill="none"
              stroke="var(--color-background)"
              strokeWidth={0.35}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ) : null}
          {useMesh && meshes.states ? (
            <path
              d={meshes.states}
              fill="none"
              stroke="var(--color-foreground)"
              strokeOpacity={0.28}
              strokeWidth={0.9}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ) : null}
          {useMesh && meshes.outline ? (
            <path
              d={meshes.outline}
              fill="none"
              stroke="var(--color-foreground)"
              strokeOpacity={0.5}
              strokeWidth={1.1}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ) : null}
          {hovered?.path ? (
            <path
              d={hovered.path}
              fill="none"
              stroke="var(--color-foreground)"
              strokeWidth={1.4}
              pointerEvents="none"
            />
          ) : null}
          {selected?.path && selected.id !== hovered?.id ? (
            <path
              d={selected.path}
              fill="none"
              stroke="var(--color-foreground)"
              strokeWidth={1.8}
              pointerEvents="none"
            />
          ) : null}
          {labels.map((f) =>
            f.centroid ? (
              <text
                key={`l-${f.id}`}
                x={f.centroid[0]}
                y={f.centroid[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none fill-foreground/70"
                style={{ fontSize: 7.2, fontFamily: "var(--font-sans)", fontWeight: 500 }}
              >
                {shortLabel(f.name)}
              </text>
            ) : null,
          )}
        </g>
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-xl bg-card px-3 py-2.5 text-card-foreground shadow-border"
          style={{
            left: Math.min(tip!.x + 14, (wrapRef.current?.clientWidth ?? 320) - 180),
            top: Math.max(8, tip!.y - 64),
          }}
        >
          <p className="truncate text-sm font-medium">{hovered.name}</p>
          {hovered.hasData ? (
            <div className="mt-1.5 space-y-1 text-xs tabular-nums text-muted-foreground">
              <p>
                <span className="text-dem">{parties.dem}</span>{" "}
                {formatPct(hovered.dem / hovered.total)} · {formatInt(hovered.dem)}
              </p>
              <p>
                <span className="text-gop">{parties.gop}</span>{" "}
                {formatPct(hovered.gop / hovered.total)} · {formatInt(hovered.gop)}
              </p>
              {hovered.inherited ? (
                <p className="text-[11px] text-muted-foreground/80">Statewide figure</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No returns in this file</p>
          )}
        </div>
      ) : null}

      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-card/90 backdrop-blur-sm"
          onClick={() => {
            const el = wrapRef.current;
            if (!el) return;
            zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.25);
          }}
          aria-label="Zoom in"
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-card/90 backdrop-blur-sm"
          onClick={() => {
            const el = wrapRef.current;
            if (!el) return;
            zoomAt(el.clientWidth / 2, el.clientHeight / 2, 0.8);
          }}
          aria-label="Zoom out"
        >
          <Minus />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-card/90 backdrop-blur-sm"
          onClick={reset}
          aria-label="Reset view"
        >
          <RotateCcw />
        </Button>
      </div>
    </div>
  );
}

function shortLabel(name: string) {
  return name
    .replace(", United States", "")
    .replace("District of Columbia", "D.C.")
    .split(",")[0]
    .replace(" County", "")
    .replace(" Parish", "");
}
