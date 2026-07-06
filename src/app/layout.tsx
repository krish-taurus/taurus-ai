import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taurus AI — Hire AI employees in five minutes",
  description:
    "Taurus AI is the world's easiest enterprise platform to hire, manage, and collaborate with AI employees.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
