import { YEARS, type Year } from "@/lib/election/catalog";
import { cn } from "@/lib/utils";

export function YearRail({
  value,
  onChange,
  disabled,
}: {
  value: Year;
  onChange: (year: Year) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role="tablist" aria-label="Election year">
      {YEARS.map((year) => {
        const active = year === value;
        return (
          <button
            key={year}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(year)}
            className={cn(
              "h-9 rounded-lg px-2.5 font-mono text-xs font-medium tabular-nums transition-[background-color,color] duration-150 sm:px-3 sm:text-sm",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              disabled && "opacity-40",
            )}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
