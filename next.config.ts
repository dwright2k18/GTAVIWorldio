import type { NextConfig } from "next";

const imageHosts = new Set(["gtaviworld.io", "www.gtaviworld.io"]);
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  imageHosts.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname);
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: Array.from(imageHosts).map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
  },
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
