"use client";

import { cn } from "@/lib/utils";

type ProductStarRatingProps = {
  rating: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const starSizeClass = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

export function ProductStarRating({
  rating,
  max = 5,
  size = "md",
  className,
}: ProductStarRatingProps) {
  const filled = Math.max(0, Math.min(max, Math.round(rating)));

  return (
    <span
      className={cn("inline-flex gap-0.5 text-[rgb(var(--color-success-text))]", className)}
      aria-hidden
    >
      {Array.from({ length: max }, (_, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          className={cn(starSizeClass[size], index < filled ? "opacity-100" : "opacity-20")}
          fill="currentColor"
        >
          <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}
