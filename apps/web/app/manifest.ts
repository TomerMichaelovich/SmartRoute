import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAVIO",
    short_name: "NAVIO",
    description: "קניות חכמות: תכננו את המסלול, חסכו זמן וקנו רק מה שתכננתם",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#011e50",
    icons: [
      {
        src: "/icons/navio-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/navio-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
