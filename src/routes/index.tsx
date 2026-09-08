import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { ElectionMap } from "@/components/map/election-map";
import { MapLegend } from "@/components/map/map-legend";
import { HowToRead } from "@/components/app/how-to-read";
import { Inspector } from "@/components/app/inspector";
import { ModeToggle } from "@/components/app/mode-toggle";
import { UploadDialog } from "@/components/app/upload-dialog";
import { YearRail } from "@/components/app/year-rail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import {
  GEOGRAPHIES,
  HARBOR_CITY_ID,
  geographyForLevel,
  isYear,
  loadBuiltinElection,
  loadGeography,
  loadHarborCity,
  type Year,
} from "@/lib/election/catalog";
import { featureColor } from "@/lib/election/color";
import { prepareMap } from "@/lib/election/geo";
import { joinFeatures } from "@/lib/election/join";
import { summarize, summarizeRows, EMPTY_STATS } from "@/lib/election/stats";
import seed2024Counties from "../../public/data/elections/2024-president-counties.json";
import { useElectionStore } from "@/lib/election/store";
import type {
  ColorMode,
  ElectionPayload,
  GeoLevel,
  GeographySpec,
  JoinedFeature,
  MapMeshes,
} from "@/lib/election/types";
import { cn } from "@/lib/utils";

type Search = {
  y: Year;
  g: GeoLevel;
  m: ColorMode;
  d?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const yNum = Number(raw.y);
    const y: Year = isYear(yNum) ? yNum : 2024;
    const g: GeoLevel = raw.g === "states" ? "states" : "counties";
    const m: ColorMode = raw.m === "winner" || raw.m === "margin" ? raw.m : "blend";
    const d = typeof raw.d === "string" && raw.d ? raw.d : undefined;
    return { y, g, m, d };
  },
  component: Home,
});

function seedElection(search: Search): ElectionPayload | null {
  if (search.d) return null;
  if (search.y === 2024 && search.g === "counties") {
    return seed2024Counties as ElectionPayload;
  }
  return null;
}

function Home() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const custom = useElectionStore((s) => s.custom);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [election, setElection] = useState<ElectionPayload | null>(() => seedElection(search));
  const [spec, setSpec] = useState<GeographySpec>(geographyForLevel("counties"));
  const [geoData, setGeoData] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contrast, setContrast] = useState(1);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [size, setSize] = useState({ w: 960, h: 560 });
  const mapBox = useRef<HTMLDivElement>(null);

  const isCustom = Boolean(search.d);

  useEffect(() => {
    const el = mapBox.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ w: Math.max(320, cr.width), h: Math.max(240, cr.height) });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    setStatus("loading");
    setError(null);
    setSelectedId(null);
    setGeoData(null);

    async function run() {
      if (search.d) {
        if (search.d === HARBOR_CITY_ID) {
          const elP = loadHarborCity();
          const geoP = loadGeography(GEOGRAPHIES["harbor-city"]);
          const el = await elP;
          if (!live) return;
          setElection(el);
          setSpec(GEOGRAPHIES["harbor-city"]);
          const geo = await geoP;
          if (!live) return;
          setGeoData(geo);
          setStatus("ready");
          return;
        }
        const bundle = useElectionStore.getState().custom.find((c) => c.election.id === search.d);
        if (!bundle) throw new Error("That plugged-in map is only in this session. Load it again from Plug in.");
        setElection(bundle.election);
        setSpec(bundle.geography);
        const geo = bundle.geoData ?? (await loadGeography(bundle.geography));
        if (!live) return;
        setGeoData(geo);
        setStatus("ready");
        return;
      }

      const geoSpec = geographyForLevel(search.g);
      const elP = loadBuiltinElection(search.y, search.g);
      const geoP = loadGeography(geoSpec);
      const el = await elP;
      if (!live) return;
      setElection(el);
      setSpec(geoSpec);
      const geo = await geoP;
      if (!live) return;
      setGeoData(geo);
      setStatus("ready");
    }

    run().catch((err: unknown) => {
      if (!live) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not load this map.");
    });

    return () => {
      live = false;
    };
  }, [search.y, search.g, search.d, custom]);

  const prepared = useMemo(() => {
    if (!geoData) return { features: [], meshes: {} as MapMeshes };
    return prepareMap(geoData, spec, size.w, size.h);
  }, [geoData, spec, size.w, size.h]);

  const joined = useMemo(() => {
    if (!election) return [] as JoinedFeature[];
    return joinFeatures(prepared.features, election.rows);
  }, [prepared.features, election]);

  const colors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!election) return out;
    for (const f of joined) {
      out[f.id] = featureColor(f, search.m, contrast, election.parties);
    }
    return out;
  }, [joined, search.m, contrast, election]);

  const stats = useMemo(() => {
    if (joined.some((f) => f.hasData)) return summarize(joined);
    if (election) return summarizeRows(election.rows);
    return EMPTY_STATS;
  }, [joined, election]);
  const selected = joined.find((f) => f.id === selectedId) ?? null;

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return joined
      .filter((f) => f.name.toLowerCase().includes(q) || f.id.includes(q))
      .slice(0, 8);
  }, [joined, query]);

  const demLabel = election?.parties.find((p) => p.id === "dem")?.label ?? "Dem";
  const gopLabel = election?.parties.find((p) => p.id === "gop")?.label ?? "GOP";

  function patchSearch(next: Partial<Search>) {
    void navigate({
      search: (prev) => ({ ...prev, ...next }),
    });
  }

  const inspector = election ? (
    <Inspector
      election={election}
      feature={selected}
      stats={stats}
      mode={search.m}
      contrast={contrast}
      unitLabel={spec.title.replace("U.S. ", "")}
    />
  ) : null;

  return (
    <main className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-none font-medium tracking-tight sm:text-2xl">
              America Actually
            </p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              See the mix, not just the winner
            </p>
          </div>
          <HowToRead />
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a href="/america-actually.zip" download="america-actually.zip">
              <Download className="size-3.5" />
              Download
            </a>
          </Button>
          <UploadDialog
            onAdded={(id) => {
              void navigate({ search: { y: search.y, g: search.g, m: search.m, d: id } });
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <YearRail
            value={search.y}
            disabled={isCustom}
            onChange={(y) => patchSearch({ y, d: undefined })}
          />
          <div className="inline-flex rounded-xl bg-secondary p-1">
            {(["counties", "states"] as const).map((level) => (
              <button
                key={level}
                type="button"
                disabled={isCustom}
                onClick={() => patchSearch({ g: level, d: undefined })}
                className={cn(
                  "h-9 rounded-lg px-3 text-sm font-medium capitalize transition-colors",
                  !isCustom && search.g === level
                    ? "bg-card text-foreground shadow-border"
                    : "text-muted-foreground hover:text-foreground",
                  isCustom && "opacity-40",
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              patchSearch({
                d: search.d === HARBOR_CITY_ID ? undefined : HARBOR_CITY_ID,
              })
            }
            className={cn(
              "hidden h-9 rounded-lg px-3 text-sm font-medium transition-colors sm:inline-flex sm:items-center",
              search.d === HARBOR_CITY_ID
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            Sample city
          </button>
          {custom.map((c) => (
            <button
              key={c.election.id}
              type="button"
              onClick={() => patchSearch({ d: c.election.id })}
              className={cn(
                "h-9 max-w-40 truncate rounded-lg px-3 text-sm font-medium transition-colors",
                search.d === c.election.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {c.election.title}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="relative flex min-w-0 flex-1 flex-col">
          <div ref={mapBox} className="relative min-h-0 flex-1">
            {status === "error" ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {error}
              </div>
            ) : joined.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Drawing returns…
              </div>
            ) : (
              <ElectionMap
                features={joined}
                meshes={prepared.meshes}
                colors={colors}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  if (id && window.matchMedia("(max-width: 767px)").matches) setSheetOpen(true);
                }}
                showLabels={spec.id === "us-states" || spec.id === "harbor-city"}
                useMesh={Boolean(spec.useMesh)}
                parties={{ dem: demLabel, gop: gopLabel }}
                width={size.w}
                height={size.h}
              />
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <ModeToggle value={search.m} onChange={(m) => patchSearch({ m })} />
            <MapLegend mode={search.m} contrast={contrast} demLabel={demLabel} gopLabel={gopLabel} />
            <label className="flex w-full max-w-xs flex-col gap-1 sm:w-44">
              <span className="flex justify-between text-[11px] text-muted-foreground">
                <span>True mix</span>
                <span>Polarize</span>
              </span>
              <Slider
                min={0.4}
                max={2.6}
                step={0.05}
                value={[contrast]}
                onValueChange={(v) => setContrast(v[0] ?? 1)}
              />
            </label>
          </div>
        </section>

        <aside className="hidden w-[340px] shrink-0 border-l border-border md:flex md:flex-col">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a place"
                className="pl-9"
                aria-label="Find a place"
              />
            </div>
            {hits.length > 0 ? (
              <ul className="mt-2 overflow-hidden rounded-xl bg-secondary/70">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="flex w-full px-3 py-2 text-left text-sm hover:bg-card"
                      onClick={() => {
                        setSelectedId(h.id);
                        setQuery("");
                      }}
                    >
                      {h.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-5">{inspector}</div>
          </ScrollArea>
        </aside>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-2 md:hidden">
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          {selected ? selected.name : election?.title ?? "America Actually"}
        </p>
        <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
          Details
        </Button>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Returns</SheetTitle>
          </SheetHeader>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a place"
              className="pl-9"
            />
          </div>
          {hits.length > 0 ? (
            <ul className="mb-3 overflow-hidden rounded-xl bg-secondary/70">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="flex w-full px-3 py-2.5 text-left text-sm"
                    onClick={() => {
                      setSelectedId(h.id);
                      setQuery("");
                    }}
                  >
                    {h.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="max-h-[50dvh] overflow-y-auto pb-4">{inspector}</div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
