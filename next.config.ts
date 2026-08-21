import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.gtaviworld.io" }],
        destination: "https://gtaviworld.io/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
