import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@compliance-ai/frameworks",
    "@compliance-ai/db",
    "@compliance-ai/chat-structure",
  ],
  typedRoutes: true,
};

export default config;
