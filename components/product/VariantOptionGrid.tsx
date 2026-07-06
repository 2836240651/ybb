"use client";

import { cn } from "@/lib/utils";

export type VariantOption = {
  value: string;
  label: string;
};

type VariantOptionGridProps = {
  label: string;
  options: readonly VariantOption[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3;
};

export function VariantOptionGrid({
  label,
  options,
  value,
  onChange,
  columns = 3,
}: VariantOptionGridProps) {
  const selectedLabel =
    options.find((opt) => opt.value === value)?.label ?? value;

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-foreground/70">{selectedLabel}</span>
      </p>
      <div
        className={cn(
          "grid gap-2",
          columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
        )}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-input border px-3 py-2.5 text-sm text-center",
                "transition-[border-color,background-color] duration-300 ease-primary",
                selected
                  ? "border-foreground border-2 font-medium"
                  : "border-border hover:border-foreground/30"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
