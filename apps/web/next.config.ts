import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server serve /_next/* (incl. HMR) to phones/other devices
  // on the same network testing via the "Network" URL `next dev` prints -
  // otherwise Next.js blocks those cross-origin dev requests by default,
  // which breaks hydration entirely (page loads but nothing is interactive).
  // Update this if your machine's LAN IP changes.
  allowedDevOrigins: ["10.0.0.4"],
  // @smartroute/core is an unbuilt TS workspace package (moved out of src/ during
  // the React Native migration) - Next doesn't transpile local workspace packages
  // by default, only node_modules deps shipped as JS.
  transpilePackages: ["@smartroute/core"],
  // Default Server Action body limit (1MB) is too small for an uploaded store photo.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
