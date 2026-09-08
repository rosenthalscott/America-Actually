import { formatInt, formatPct } from "@/lib/utils";
import { featureColor } from "@/lib/election/color";
import type { ColorMode, ElectionPayload, JoinedFeature } from "@/lib/election/types";
import type { NationalStats } from "@/lib/election/stats";
import { Separator } from "@/components/ui/separator";

export function Inspector({
  election,
  feature,
  stats,
  mode,
  contrast,
  unitLabel,
}: {
  election: ElectionPayload;
  feature: JoinedFeature | null;
  stats: NationalStats;
  mode: ColorMode;
  contrast: number;
  unitLabel: string;
}) {
  const demP = election.parties.find((p) => p.id === "dem");
  const gopP = election.parties.find((p) => p.id === "gop");

  return (
    <div className="flex flex-col gap-5">
      {feature ? (
        <PlaceCard
          feature={feature}
          election={election}
          mode={mode}
          contrast={contrast}
          demLabel={demP?.label ?? "Dem"}
          gopLabel={gopP?.label ?? "GOP"}
        />
      ) : (
        <div>
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Select a place
          </p>
          <h2 className="font-display mt-1 text-2xl leading-tight font-medium tracking-tight">
            {election.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Click any place on the map to see its mix versus winner-take-all.
          </p>
        </div>
      )}

      <Separator />

      <div>
        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Mapped returns
        </p>
        <div className="mt-3 space-y-2.5">
          <VoteBar
            label={demP?.label ?? "Dem"}
            votes={stats.dem}
            total={stats.total}
            color="var(--color-dem)"
          />
          <VoteBar
            label={gopP?.label ?? "GOP"}
            votes={stats.gop}
            total={stats.total}
            color="var(--color-gop)"
          />
          {stats.oth > 0 ? (
            <VoteBar label="Other" votes={stats.oth} total={stats.total} color="var(--color-blend)" />
          ) : null}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Stat label={`${demP?.shortLabel ?? "D"} wins`} value={formatInt(stats.demWins)} />
          <Stat label={`${gopP?.shortLabel ?? "R"} wins`} value={formatInt(stats.gopWins)} />
          <Stat label="Within 5 pts" value={formatInt(stats.close)} />
          <Stat label={unitLabel} value={formatInt(stats.withData)} />
        </dl>
      </div>

      {election.source ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{election.source}</p>
      ) : null}
      {election.notes ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{election.notes}</p>
      ) : null}
    </div>
  );
}

function PlaceCard({
  feature,
  election,
  mode,
  contrast,
  demLabel,
  gopLabel,
}: {
  feature: JoinedFeature;
  election: ElectionPayload;
  mode: ColorMode;
  contrast: number;
  demLabel: string;
  gopLabel: string;
}) {
  const mix = featureColor(feature, "blend", contrast, election.parties);
  const wta = featureColor(feature, "winner", 1, election.parties);
  const winner =
    !feature.hasData || feature.dem === feature.gop
      ? "Toss-up"
      : feature.dem > feature.gop
        ? demLabel
        : gopLabel;

  return (
    <div>
      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {feature.inherited ? "Statewide (no local split)" : election.office ?? "Place"}
      </p>
      <h2 className="font-display mt-1 text-2xl leading-tight font-medium tracking-tight">
        {feature.name}
      </h2>
      {feature.hasData ? (
        <>
          <div className="mt-4 space-y-2.5">
            <VoteBar label={demLabel} votes={feature.dem} total={feature.total} color="var(--color-dem)" />
            <VoteBar label={gopLabel} votes={feature.gop} total={feature.total} color="var(--color-gop)" />
            {feature.oth > 0 ? (
              <VoteBar label="Other" votes={feature.oth} total={feature.total} color="var(--color-blend)" />
            ) : null}
          </div>
          <div className="mt-4 flex gap-3">
            <Swatch color={mix} label="This mix" />
            <Swatch color={wta} label={`Winner-take-all: ${winner}`} />
          </div>
          {mode === "winner" ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Winner-take-all hides a {formatPct(Math.min(feature.dem, feature.gop) / feature.total)}{" "}
              minority.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No returns matched this geography.</p>
      )}
    </div>
  );
}

function VoteBar({
  label,
  votes,
  total,
  color,
}: {
  label: string;
  votes: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? votes / total : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatPct(pct)} · {formatInt(votes)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="size-7 shrink-0 rounded-md shadow-border"
        style={{ background: color }}
        aria-hidden
      />
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
