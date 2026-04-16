import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@compliance-ai/agents",
    "@compliance-ai/approvals",
    "@compliance-ai/chat-structure",
    "@compliance-ai/cognition",
    "@compliance-ai/db",
    "@compliance-ai/frameworks",
    "@compliance-ai/ingest",
    "@compliance-ai/prioritizer",
  ],
  typedRoutes: true,
};

export default config;
