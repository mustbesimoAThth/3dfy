"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  prepareImage,
  type PreparedImage,
} from "@/lib/image";
import { cn } from "@/lib/utils";

export type { PreparedImage } from "@/lib/image";

export function ImageDropzone({
  value,
  onChange,
  disabled,
}: {
  value: PreparedImage | null;
  onChange: (img: PreparedImage | null) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("That's not an image.");
        return;
      }
      if (file.size > IMAGE_MAX_BYTES) {
        setError("Image must be under 12 MB.");
        return;
      }
      setBusy(true);
      try {
        const prepared = await prepareImage(file);
        onChange(prepared);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read that image.");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  // Listen for paste at window level so it works anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            void handleFile(f);
            e.preventDefault();
            break;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile, disabled]);

  function clear() {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={cn(
          "relative grid min-h-64 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border/80 bg-background/40 backdrop-blur transition",
          dragOver && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.previewUrl}
              alt="preview"
              className="h-72 w-full object-contain p-3"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              aria-label="Remove image"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-background/80 text-foreground shadow hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-3 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              {value.width} × {value.height}
            </div>
          </>
        ) : busy ? (
          <div className="flex flex-col items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Preparing image…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <ImagePlus className="h-6 w-6" />
            </span>
            <p className="text-sm">
              <span className="font-medium text-foreground">Tap to upload</span>{" "}
              or drag, drop, paste.
            </p>
            <p className="text-xs">PNG, JPG, WEBP, AVIF, GIF · up to 12 MB</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-accent disabled:opacity-50 sm:hidden"
        >
          <Camera className="h-3.5 w-3.5" />
          Use camera
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {error && (
          <p className="ml-auto text-xs text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
