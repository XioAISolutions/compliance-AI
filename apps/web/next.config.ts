import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@compliance-ai/frameworks", "@compliance-ai/db"],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
