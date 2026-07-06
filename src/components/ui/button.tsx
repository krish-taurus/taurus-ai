/**
 * Button primitive (Sprint 005B) — premium monochrome.
 *
 * `buttonClasses()` is exported so links (<Link>) and server-action <button>s can
 * share the exact same styling without wrapping. Focus is handled globally via
 * :focus-visible (see globals.css) for consistent keyboard rings.
 */

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ease-taurus disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-taurus-primary text-taurus-onPrimary hover:bg-taurus-primary/90 active:bg-taurus-primary/80",
  secondary:
    "border border-taurus-line bg-taurus-elevated text-taurus-text hover:border-taurus-strong hover:bg-taurus-muted",
  ghost: "text-taurus-sub hover:bg-taurus-muted hover:text-taurus-text",
  outline:
    "border border-taurus-line text-taurus-text hover:border-taurus-strong hover:bg-taurus-muted",
  danger: "border border-taurus-strong text-taurus-text hover:bg-taurus-muted",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
