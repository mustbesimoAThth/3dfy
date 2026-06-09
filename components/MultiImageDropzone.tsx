"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Plus, X } from "lucide-react";
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  prepareImage,
  type PreparedImage,
} from "@/lib/image";
import { cn } from "@/lib/utils";

/**
 * Multi-image dropzone for the Standard (multi-view) tier. Up to `max`
 * images, displayed in upload order. Each tile has its own remove button.
 *
 * Caller owns the array and is responsible for revoking object URLs on
 * unmount (we revoke when the user explicitly removes an image).
 */
export function MultiImageDropzone({
  value,
  onChange,
  max,
  disabled,
}: {
  value: PreparedImage[];
  onChange: (next: PreparedImage[]) => void;
  max: number;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, max - value.length);

  const addFiles = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      if (!files) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      setError(null);

      const accepted = list
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);
      if (accepted.length === 0) {
        if (remaining === 0) {
          setError(`You can upload up to ${max} images.`);
        } else {
          setError("That's not an image.");
        }
        return;
      }
      const tooBig = accepted.find((f) => f.size > IMAGE_MAX_BYTES);
      if (tooBig) {
        setError("Each image must be under 12 MB.");
        return;
      }

      setBusy(true);
      try {
        const prepared = await Promise.all(accepted.map(prepareImage));
        onChange([...value, ...prepared]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read that image.");
      } finally {
        setBusy(false);
      }
    },
    [max, onChange, remaining, value],
  );

  // Window-level paste so it works anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled || remaining === 0) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void addFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles, disabled, remaining]);

  function removeAt(idx: number) {
    const removed = value[idx];
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(value.filter((_, i) => i !== idx));
  }

  const empty = value.length === 0;

  return (
    <div className="space-y-2">
      {empty ? (
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
            void addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "relative grid min-h-64 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border/80 bg-background/40 backdrop-blur transition",
            dragOver && "border-primary bg-primary/5",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Preparing images…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <ImagePlus className="h-6 w-6" />
              </span>
              <p className="text-sm">
                <span className="font-medium text-foreground">
                  Tap to upload
                </span>{" "}
                or drag, drop, paste — up to {max} views.
              </p>
              <p className="text-xs">
                Front, back, sides… more views = more accurate 3D.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && remaining > 0) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled) return;
            void addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-2xl border-2 border-dashed border-border/80 bg-background/40 p-3 backdrop-blur transition",
            dragOver && "border-primary bg-primary/5",
            disabled && "opacity-60",
          )}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {value.map((img, i) => (
              <div
                key={img.previewUrl}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-background"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={`view ${i + 1}`}
                  className="h-full w-full object-contain"
                />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
                  {i + 1}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeAt(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/80 text-foreground shadow transition hover:bg-background disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {remaining > 0 && (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/80 bg-background/30 text-muted-foreground transition hover:border-primary hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
                <span className="text-[11px]">
                  Add view ({value.length}/{max})
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled || remaining === 0}
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
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {error ? (
          <p className="ml-auto text-xs text-destructive">{error}</p>
        ) : (
          <p className="ml-auto text-xs text-muted-foreground">
            {value.length === 0
              ? `Up to ${max} images · 12 MB each`
              : `${value.length} of ${max} views`}
          </p>
        )}
      </div>
    </div>
  );
}
