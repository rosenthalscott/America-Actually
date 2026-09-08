import { useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GEOGRAPHIES, HARBOR_CITY_ID } from "@/lib/election/catalog";
import { asFeatureCollection } from "@/lib/election/geo";
import {
  DEFAULT_PARTIES,
  detectColumns,
  looksLikeGeography,
  makeCustomPayload,
  parseCsv,
  parseResultsJson,
  readFileText,
  resultsFromGeojson,
  rowsFromObjects,
  type ColumnMapping,
} from "@/lib/election/parse";
import { useElectionStore } from "@/lib/election/store";
import type { GeographySpec, ResultRow } from "@/lib/election/types";
import { cn } from "@/lib/utils";

type GeoChoice = "us-counties" | "us-states" | "upload";

export function UploadDialog({ onAdded }: { onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const addCustom = useElectionStore((s) => s.addCustom);
  const [title, setTitle] = useState("");
  const [geoChoice, setGeoChoice] = useState<GeoChoice>("us-counties");
  const [geoFileName, setGeoFileName] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<unknown>(null);
  const [resultName, setResultName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [objects, setObjects] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [embeddedRows, setEmbeddedRows] = useState<ResultRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const geoInput = useRef<HTMLInputElement>(null);
  const resInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setGeoChoice("us-counties");
    setGeoFileName(null);
    setGeoData(null);
    setResultName(null);
    setHeaders([]);
    setObjects([]);
    setMapping({});
    setEmbeddedRows(null);
  };

  const previewCount = useMemo(() => {
    if (embeddedRows) return embeddedRows.length;
    if (!mapping.id) return 0;
    return rowsFromObjects(objects, mapping).length;
  }, [embeddedRows, objects, mapping]);

  async function onGeoFile(file: File) {
    try {
      const text = await readFileText(file);
      const data = JSON.parse(text) as unknown;
      if (!looksLikeGeography(data)) {
        toast.error("That file is not GeoJSON or TopoJSON.");
        return;
      }
      const spec: GeographySpec = {
        id: "upload",
        title: file.name,
        url: "",
        format: (data as { type?: string }).type === "Topology" ? "topojson" : "geojson",
        idProperty: "id",
        nameProperty: "name",
        projection: "fit",
      };
      asFeatureCollection(data, spec);
      const embedded = resultsFromGeojson(data, spec);
      setGeoData(data);
      setGeoFileName(file.name);
      setGeoChoice("upload");
      setEmbeddedRows(embedded);
      if (embedded) {
        toast.success(`Map includes votes for ${embedded.length} places.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that map.");
    }
  }

  async function onResultFile(file: File) {
    try {
      const text = await readFileText(file);
      const isJson = /\.json$/i.test(file.name) || text.trim().startsWith("{") || text.trim().startsWith("[");
      const parsed = isJson ? parseResultsJson(JSON.parse(text)) : parseCsv(text);
      const next = detectColumns(parsed.headers);
      setHeaders(parsed.headers);
      setObjects(parsed.objects);
      setMapping(next);
      setResultName(file.name);
      setEmbeddedRows(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read results.");
    }
  }

  function submit() {
    setBusy(true);
    try {
      let spec: GeographySpec;
      let data: unknown | undefined;
      if (geoChoice === "upload") {
        if (!geoData) throw new Error("Upload a GeoJSON or TopoJSON map.");
        spec = {
          id: `custom-geo-${Date.now().toString(36)}`,
          title: geoFileName ?? "Custom map",
          url: "",
          format: (geoData as { type?: string }).type === "Topology" ? "topojson" : "geojson",
          idProperty: "id",
          nameProperty: "name",
          projection: "fit",
          useMesh: false,
        };
        data = geoData;
      } else {
        spec = GEOGRAPHIES[geoChoice];
      }

      const rows =
        embeddedRows ??
        rowsFromObjects(objects, mapping);
      if (rows.length === 0) {
        throw new Error("No rows mapped. Check that the id column matches the map.");
      }

      const election = makeCustomPayload({
        title: title.trim() || "Custom election",
        geographyId: spec.id,
        rows,
        parties: DEFAULT_PARTIES,
        source: [geoFileName, resultName].filter(Boolean).join(" + ") || "Uploaded in this session",
      });

      addCustom({ election, geography: spec, geoData: data });
      toast.success(`Loaded ${rows.length} places.`);
      onAdded(election.id);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that dataset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="size-3.5" />
          Plug in
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plug in a map</DialogTitle>
          <DialogDescription>
            Pair any polygon map with a vote table. Ids on the map have to match the id column.
            A GeoJSON that already has dem / gop properties works as a single file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ds-title">Name</Label>
            <Input
              id="ds-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="2024 school board, Ward 3"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Geography</Label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["us-counties", "U.S. counties"],
                  ["us-states", "U.S. states"],
                  ["upload", "Upload map"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setGeoChoice(id);
                    if (id !== "upload") {
                      setGeoData(null);
                      setGeoFileName(null);
                      setEmbeddedRows(null);
                    }
                  }}
                  className={cn(
                    "h-9 rounded-lg px-3 text-sm font-medium transition-colors",
                    geoChoice === id
                      ? "bg-foreground text-background"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {geoChoice === "upload" ? (
              <DropSlot
                label={geoFileName ?? "GeoJSON or TopoJSON"}
                accept=".json,.geojson,.topojson"
                inputRef={geoInput}
                onFile={onGeoFile}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Join on FIPS: 5 digits for counties, 2 for states (e.g. 06037, 06).
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Results</Label>
            {embeddedRows ? (
              <p className="text-sm text-muted-foreground">
                Using {embeddedRows.length} vote records embedded in the map.
              </p>
            ) : (
              <>
                <DropSlot
                  label={resultName ?? "CSV or JSON"}
                  accept=".csv,.json,.txt"
                  inputRef={resInput}
                  onFile={onResultFile}
                />
                <p className="text-xs text-muted-foreground">
                  Headers such as id, name, dem, gop, oth.{" "}
                  <a className="underline underline-offset-2" href="/data/sample-results.csv" download>
                    Sample CSV
                  </a>
                </p>
              </>
            )}
          </div>

          {headers.length > 0 && !embeddedRows ? (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["id", "Id"],
                  ["name", "Name"],
                  ["dem", "Left / Dem"],
                  ["gop", "Right / GOP"],
                  ["oth", "Other"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <select
                    className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
                    value={mapping[key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
                  >
                    <option value="">{key === "oth" || key === "name" ? "(none)" : "Choose"}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}

          {previewCount > 0 ? (
            <p className="font-mono text-xs tabular-nums text-muted-foreground">{previewCount} rows ready</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onAdded(HARBOR_CITY_ID);
              setOpen(false);
              reset();
            }}
          >
            Try sample city
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Add to map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DropSlot({
  label,
  accept,
  inputRef,
  onFile,
}: {
  label: string;
  accept: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className="flex h-20 w-full items-center justify-center rounded-xl border border-dashed border-input bg-muted/40 px-3 text-center text-sm text-muted-foreground transition-colors hover:bg-muted"
    >
      {label}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </button>
  );
}
