import { fal } from "@fal-ai/client";
import { z } from "zod";
import type { FalModelId } from "@/lib/types/database";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

export { fal };

// ---------------------------------------------------------------------------
// Per-model option schemas
// ---------------------------------------------------------------------------

/** Options for the default Standard engine (multi-view recon; up to 4 views). */
export const reconOptionsSchema = z.object({
  resolution: z.union([z.literal(512), z.literal(1024), z.literal(1536)]).default(1024),
  texture_size: z
    .union([z.literal(1024), z.literal(2048), z.literal(4096)])
    .default(2048),
  ss_source: z.enum(["direct", "mesh", "mvtrellis2"]).default("mesh"),
});
export type ReconOptions = z.infer<typeof reconOptionsSchema>;

/** Max number of input images accepted by the multi-view Standard tier. */
export const RECON_MAX_IMAGES = 4;

/**
 * Max number of input images accepted by the H3.1 multi-view tier.
 * Matches the example in the fal docs:
 *   https://fal.ai/models/tripo3d/h3.1/multiview-to-3d
 */
export const H31_MV_MAX_IMAGES = 4;

export const p1OptionsSchema = z.object({
  texture: z.boolean().default(true),
});
export type P1Options = z.infer<typeof p1OptionsSchema>;

export const h31OptionsSchema = z.object({
  texture: z.enum(["no", "standard", "HD"]).default("standard"),
  detailed_geometry: z.boolean().default(false),
  quad: z.boolean().default(false),
  pbr: z.boolean().default(true),
});
export type H31Options = z.infer<typeof h31OptionsSchema>;

export const generateRequestSchema = z.discriminatedUnion("model", [
  z.object({
    model: z.literal("fal-ai/reconviagen-0.5"),
    // Standard tier accepts 1..RECON_MAX_IMAGES views of the same object.
    input_image_paths: z
      .array(z.string().min(1))
      .min(1)
      .max(RECON_MAX_IMAGES),
    options: reconOptionsSchema,
  }),
  z.object({
    model: z.literal("tripo3d/p1/image-to-3d"),
    input_image_path: z.string().min(1),
    options: p1OptionsSchema,
  }),
  z.object({
    model: z.literal("tripo3d/h3.1/multiview-to-3d"),
    // Advanced tier accepts 1..H31_MV_MAX_IMAGES views.
    input_image_paths: z
      .array(z.string().min(1))
      .min(1)
      .max(H31_MV_MAX_IMAGES),
    options: h31OptionsSchema,
  }),
]);
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/**
 * The list of input image storage paths for any GenerateRequest, regardless
 * of whether the underlying model is single- or multi-image. The first entry
 * is treated as the "primary" image (used for thumbnails and back-compat with
 * `jobs.input_image_path`).
 */
export function getRequestImagePaths(req: GenerateRequest): string[] {
  if (req.model === "tripo3d/p1/image-to-3d") return [req.input_image_path];
  return req.input_image_paths;
}

// ---------------------------------------------------------------------------
// Model registry / pricing labels
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: FalModelId;
  name: string;
  tagline: string;
  description: string;
  basePrice: number;
}

export const MODELS: Record<FalModelId, ModelInfo> = {
  "fal-ai/reconviagen-0.5": {
    id: "fal-ai/reconviagen-0.5",
    name: "Standard",
    tagline: "Recommended default",
    description:
      "High-detail mesh with baked PBR. Accepts up to 4 views of the same object — front/back/sides — for more accurate reconstruction.",
    basePrice: 0,
  },
  "tripo3d/p1/image-to-3d": {
    id: "tripo3d/p1/image-to-3d",
    name: "Fast",
    tagline: "Quick & simple",
    description:
      "Single-pass generation. Great for most images — typically about a minute.",
    basePrice: 0.4,
  },
  // Deprecated single-image Advanced tier. Kept in the registry so historical
  // job rows still resolve a name/description; not exposed in ModelPicker.
  "tripo3d/h3.1/image-to-3d": {
    id: "tripo3d/h3.1/image-to-3d",
    name: "Advanced",
    tagline: "Higher quality",
    description:
      "Single-image Advanced tier (legacy). Optional HD textures, detailed geometry and quad mesh.",
    basePrice: 0.2,
  },
  "tripo3d/h3.1/multiview-to-3d": {
    id: "tripo3d/h3.1/multiview-to-3d",
    name: "Advanced",
    tagline: "Higher quality + multi-view",
    description:
      "Tripo H3.1 multi-view: up to 4 images of the same object. Optional HD textures, detailed geometry and quad mesh.",
    basePrice: 0.1,
  },
};

/**
 * Estimate the cost of a generation in USD (Tripo tiers are documented on fal;
 * Standard tier is metered — this is a rough lower bound for UI only).
 *
 * H3.1 multi-view pricing (per fal docs, 2026):
 *   $0.10 (no texture) / $0.20 (standard) / $0.30 (HD)
 *   + $0.20 detailed geometry, + $0.05 quad mesh.
 */
export function estimateCost(req: GenerateRequest): number {
  if (req.model === "fal-ai/reconviagen-0.5") {
    let c = 0.35;
    if (req.options.resolution >= 1536) c += 0.12;
    if (req.options.texture_size >= 4096) c += 0.1;
    if (req.options.ss_source === "mesh") c += 0.05;
    return Math.round(c * 100) / 100;
  }
  if (req.model === "tripo3d/p1/image-to-3d") {
    return req.options.texture ? 0.5 : 0.4;
  }
  // tripo3d/h3.1/multiview-to-3d
  let cost = 0.1;
  if (req.options.texture === "standard") cost += 0.1;
  if (req.options.texture === "HD") cost += 0.2;
  if (req.options.detailed_geometry) cost += 0.2;
  if (req.options.quad) cost += 0.05;
  return Math.round(cost * 100) / 100;
}

/**
 * Map our internal options to the exact input shape each generator model expects.
 *
 * `imageUrls` is always passed as an array (in display order). Single-image
 * models use only the first URL; the multi-view Standard tier consumes them all.
 */
export function buildFalInput(
  req: GenerateRequest,
  imageUrls: string[],
): Record<string, unknown> {
  if (imageUrls.length === 0) {
    throw new Error("buildFalInput called with no image URLs.");
  }
  if (req.model === "fal-ai/reconviagen-0.5") {
    return {
      image_urls: imageUrls,
      resolution: req.options.resolution,
      texture_size: req.options.texture_size,
      ss_source: req.options.ss_source,
    };
  }
  if (req.model === "tripo3d/p1/image-to-3d") {
    return {
      image_url: imageUrls[0],
      texture: req.options.texture,
    };
  }
  // tripo3d/h3.1/multiview-to-3d — same H3.1 option shape as the legacy
  // single-image variant, but takes `image_urls` instead of `image_url`.
  const o = req.options;
  const textureOn = o.texture !== "no";
  return {
    image_urls: imageUrls,
    texture: textureOn,
    ...(textureOn
      ? {
          texture_quality: o.texture === "HD" ? "detailed" : "standard",
          pbr: o.pbr,
        }
      : { pbr: false }),
    geometry_quality: o.detailed_geometry ? "detailed" : "standard",
    quad: o.quad,
  };
}

// ---------------------------------------------------------------------------
// Webhook payload — fal posts model-specific output in `payload`
// ---------------------------------------------------------------------------

export interface FalWebhookSuccessPayload {
  request_id?: string;
  status?: "OK" | "ERROR";
  payload?: FalModelOutput;
  error?: string | null;
}

/** Union of known fal outputs (Tripo vs ReconViaGen-style). */
export interface FalModelOutput {
  model_glb?: TripoFile;
  model_mesh?: TripoFile;
  model_urls?: {
    glb?: TripoFile | null;
    base_model?: TripoFile | null;
    pbr_model?: TripoFile | null;
  };
  rendered_image?: TripoFile | null;
}

export interface TripoFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

export function pickArtifacts(out: FalModelOutput | undefined) {
  const glb =
    out?.model_glb?.url ??
    out?.model_urls?.glb?.url ??
    out?.model_mesh?.url ??
    null;
  const pbrGlb = out?.model_urls?.pbr_model?.url ?? null;
  const preview = out?.rendered_image?.url ?? null;
  return { glb, pbrGlb, preview };
}
