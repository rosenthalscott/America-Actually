import { cn } from "@/lib/utils";
import type { ColorMode } from "@/lib/election/types";

const MODES: { id: ColorMode; label: string }[] = [
  { id: "blend", label: "Blend" },
  { id: "winner", label: "Winner" },
  { id: "margin", label: "Margin" },
];

export function ModeToggle({
  value,
  onChange,
}: {
  value: ColorMode;
  onChange: (mode: ColorMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Color mode"
      className="inline-flex rounded-xl bg-secondary p-1"
    >
      {MODES.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.id)}
            className={cn(
              "h-9 min-w-16 rounded-lg px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
              active
                ? "bg-card text-foreground shadow-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
