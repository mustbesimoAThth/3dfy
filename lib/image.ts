/**
 * Browser-side image preparation helpers.
 *
 * Resizes large/heavy images down to a sane upload size (max dimension
 * 2048 px, re-encoded as WebP at q=0.92) so we don't blow through the
 * Supabase Storage 25 MB cap or wait forever on slow connections.
 */

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/avif,image/gif";
export const IMAGE_MAX_DIM = 2048;
export const IMAGE_MAX_BYTES = 12 * 1024 * 1024;

export interface PreparedImage {
  /** Object URL for preview (caller is responsible for revoking). */
  previewUrl: string;
  blob: Blob;
  /** Original filename (best-effort). */
  filename: string;
  width: number;
  height: number;
}

/**
 * Reads a File, validates and downsizes it (when needed), and returns a
 * PreparedImage with a fresh object URL. Throws on decode failure.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const previewUrl = URL.createObjectURL(file);
  const img = await loadImage(previewUrl);
  const { width: w0, height: h0 } = img;

  if (Math.max(w0, h0) <= IMAGE_MAX_DIM && file.size <= 4 * 1024 * 1024) {
    return {
      previewUrl,
      blob: file,
      filename: file.name || "image",
      width: w0,
      height: h0,
    };
  }

  const scale = Math.min(1, IMAGE_MAX_DIM / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Resize failed"))),
      "image/webp",
      0.92,
    );
  });

  URL.revokeObjectURL(previewUrl);
  const newPreview = URL.createObjectURL(blob);
  const baseName = (file.name || "image").replace(/\.[^.]+$/, "");
  return {
    previewUrl: newPreview,
    blob,
    filename: `${baseName}.webp`,
    width: w,
    height: h,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't decode image"));
    img.src = src;
  });
}
