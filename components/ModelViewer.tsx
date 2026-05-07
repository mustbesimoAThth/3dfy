"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type ModelViewerAttributes = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement> & {
    src?: string;
    alt?: string;
    poster?: string;
    ar?: boolean;
    "ar-modes"?: string;
    "camera-controls"?: boolean;
    "touch-action"?: string;
    "shadow-intensity"?: string;
    exposure?: string;
    "environment-image"?: string;
    autoplay?: boolean;
    loading?: "auto" | "lazy" | "eager";
    reveal?: "auto" | "manual";
    "ios-src"?: string;
  },
  HTMLElement
>;

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}

export function ModelViewer({
  src,
  iosSrc,
  poster,
  alt,
}: {
  src: string;
  iosSrc?: string;
  poster?: string;
  alt?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="grid h-full w-full place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <model-viewer
      src={src}
      ios-src={iosSrc}
      poster={poster}
      alt={alt ?? "3D model"}
      ar
      ar-modes="webxr scene-viewer quick-look"
      camera-controls
      touch-action="pan-y"
      shadow-intensity="1"
      exposure="1"
      autoplay
      reveal="auto"
      loading="eager"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
