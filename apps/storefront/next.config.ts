import type { NextConfig } from "next";

/** Fully static export: served free from Cloudflare Pages. Live data (stock, cart, checkout) comes from the API. */
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@pavielle/shared"],
};
export default config;
