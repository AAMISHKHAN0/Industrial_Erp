import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    const apiUrl = (process.env.API_URL || "http://127.0.0.1:4000/api/v1").replace(/\/+$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "@tanstack/react-table",
      "date-fns",
      "react-day-picker",
      "sonner",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
      "recharts",
      "lucide-react",
    ],
  },
};

export default nextConfig;
