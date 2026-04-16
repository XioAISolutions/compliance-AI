import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XIO Compliance Brain",
  description: "Citation-first securities compliance workbench. Review offering memoranda, KYC gap checks, marketing sign-off, and response memos with structured citations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
