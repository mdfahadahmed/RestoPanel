import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RestoPanel",
    short_name: "RestoPanel",
    description:
      "Cloud restaurant management — dashboard and customer ordering site in one.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0c",
    theme_color: "#0a0a0c",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
