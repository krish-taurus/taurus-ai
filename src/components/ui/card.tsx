/**
 * Card primitive (Sprint 005B). A surface with a hairline border. Set `hover`
 * for the subtle lift used on important, clickable cards.
 */

import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-taurus-line bg-taurus-surface",
        hover &&
          "transition-all duration-300 ease-taurus hover:-translate-y-0.5 hover:border-taurus-strong hover:shadow-taurus-lift",
        className,
      )}
      {...props}
    />
  );
}
