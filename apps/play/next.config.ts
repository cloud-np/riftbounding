import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.riftatlas-workers.com",
        pathname: "/**",
      },
    ],
  },
  transpilePackages: [
    "@cloud-np/auth",
    "@rift/protocol",
    "@rift/engine",
    "@rift/cards",
    "@rift/i18n",
    "@rift/sync",
  ],
  reactCompiler: true,
  agentRules: false,
  // The second asset tree (cosmetics, board lines, points rails, badges) is
  // requested same-origin by the original app; serve it from the local copy.
  async rewrites() {
    const trees = ["cosmetics", "board-lines", "points-rail", "membership", "metafy", "ui"];
    return trees.map((tree) => ({
      source: `/${tree}/:path*`,
      destination: `/riftbound/static/${tree}/:path*`,
    }));
  },
};

export default nextConfig;
