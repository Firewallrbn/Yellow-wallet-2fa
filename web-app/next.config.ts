import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen Docker mínima: server.js + solo las dependencias que se usan.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
