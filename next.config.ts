import type { NextConfig } from "next";
import variantRedirects from "./lib/data/variant-redirects.json";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "carp-ybb.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  trailingSlash: false,
  async redirects() {
    return [
      {
        source: "/collections/wholesale",
        destination: "/collections/all",
        permanent: true,
      },
      ...Object.entries(variantRedirects).map(([variantHandle, parentHandle]) => ({
        source: `/products/${variantHandle}`,
        destination: `/products/${parentHandle}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
