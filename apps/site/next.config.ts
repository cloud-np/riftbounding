import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.riftatlas-workers.com",
        pathname: "/**",
      },
    ],
  },
  transpilePackages: ["@rift/protocol", "@rift/engine", "@rift/cards", "@rift/i18n"],
  reactCompiler: true,
  agentRules: false,
};

export default nextConfig;
