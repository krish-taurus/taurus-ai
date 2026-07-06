import type { Config } from "tailwindcss";

/**
 * Taurus design tokens (Sprint 005B).
 *
 * A premium, monochrome enterprise palette — black / charcoal / grey / silver /
 * white only. Colors are defined with RGB channel CSS variables (see
 * globals.css) so Tailwind opacity modifiers work, e.g. `bg-taurus-primary/10`.
 */
const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        taurus: {
          app: withAlpha("--taurus-app"),
          surface: withAlpha("--taurus-surface"),
          elevated: withAlpha("--taurus-elevated"),
          muted: withAlpha("--taurus-muted"),
          line: withAlpha("--taurus-line"),
          strong: withAlpha("--taurus-strong"),
          text: withAlpha("--taurus-text"),
          sub: withAlpha("--taurus-sub"),
          faint: withAlpha("--taurus-faint"),
          disabled: withAlpha("--taurus-disabled"),
          focus: withAlpha("--taurus-focus"),
          primary: withAlpha("--taurus-primary"),
          onPrimary: withAlpha("--taurus-on-primary"),
        },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        "taurus-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        taurus: "0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 10px 30px -12px rgba(0, 0, 0, 0.6)",
        "taurus-lift":
          "0 0 0 1px rgb(var(--taurus-strong) / 0.6), 0 24px 60px -24px rgba(0, 0, 0, 0.85)",
      },
      transitionTimingFunction: {
        taurus: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "taurus-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "taurus-fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "taurus-fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up": "taurus-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
