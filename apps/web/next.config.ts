import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server serve /_next/* (incl. HMR) to phones/other devices
  // on the same network testing via the "Network" URL `next dev` prints -
  // otherwise Next.js blocks those cross-origin dev requests by default,
  // which breaks hydration entirely (page loads but nothing is interactive).
  // Update this if your machine's LAN IP changes.
  allowedDevOrigins: ["10.0.0.5"],
  // @smartroute/core is an unbuilt TS workspace package (moved out of src/ during
  // the React Native migration) - Next doesn't transpile local workspace packages
  // by default, only node_modules deps shipped as JS.
  transpilePackages: ["@smartroute/core"],
  // The customer-facing web UI is retired in favor of the mobile app - the
  // site is a landing page + /admin + the API. The pages stay in the codebase
  // (drop an entry here to bring one back); only shared-link pages
  // (/household/join/[code], /my-list/[code]) remain, as app-download landings.
  async redirects() {
    return [
      "/account",
      "/branches",
      "/history/:path*",
      "/household",
      "/household/list",
      "/household/new-list",
      "/list/:path*",
      "/login",
      "/my-lists",
      "/register",
      "/review/:path*",
      "/route/:path*",
      "/summary/:path*",
    ].map((source) => ({ source, destination: "/", permanent: false }));
  },
  // Default Server Action body limit (1MB) is too small for an uploaded store photo.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
