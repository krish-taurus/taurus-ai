import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://thetaurus.ai"),
  title: "Taurus AI — The operating system for AI Employees",
  description:
    "Taurus AI is the enterprise operating system for AI Employees. Hire, shape, and manage a premium AI workforce.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-taurus-app">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
