import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Taurus brand-neutral palette placeholder.
        taurus: {
          ink: "#0f172a",
          muted: "#64748b",
          accent: "#4f46e5",
        },
      },
    },
  },
  plugins: [],
};

export default config;
