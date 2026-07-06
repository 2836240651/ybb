import type { NextConfig } from "next";
import variantRedirects from "./lib/data/variant-redirects.json";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  async redirects() {
    return Object.entries(variantRedirects).map(([variantHandle, parentHandle]) => ({
      source: `/products/${variantHandle}`,
      destination: `/products/${parentHandle}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
