import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server serve /_next/* (incl. HMR) to phones/other devices
  // on the same network testing via the "Network" URL `next dev` prints -
  // otherwise Next.js blocks those cross-origin dev requests by default,
  // which breaks hydration entirely (page loads but nothing is interactive).
  // Update this if your machine's LAN IP changes.
  allowedDevOrigins: ["10.0.0.3"],
};

export default nextConfig;
