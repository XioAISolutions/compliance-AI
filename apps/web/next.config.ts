import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@compliance-ai/frameworks",
    "@compliance-ai/db",
    "@compliance-ai/agents",
    "@compliance-ai/chat-structure",
    "@compliance-ai/cognition",
    "@compliance-ai/ingestion",
  ],
  typedRoutes: true,
};

export default config;
