import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "compliance-AI",
  description: "AI-native multi-framework compliance — SOC 2, GDPR, EU AI Act, ISO 27001.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
