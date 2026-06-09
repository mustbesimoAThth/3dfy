import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "3dfy — Image to 3D",
    short_name: "3dfy",
    description: "Drop an image, get a 3D model. Engineered by Simone Leonelli.",
    id: "/",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f7fc",
    theme_color: "#f3f7fc",
    categories: ["graphics", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New generation",
        short_name: "New",
        url: "/app",
      },
    ],
  };
}
