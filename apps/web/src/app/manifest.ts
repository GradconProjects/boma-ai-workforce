import type { MetadataRoute } from "next";

/** Installable app (phone home screen or desktop). Works offline via public/sw.js. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Boma AI Workforce",
    short_name: "Boma",
    description: "Chat with your Chief of Staff and the bots it coordinates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0e17",
    theme_color: "#0b0e17",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
