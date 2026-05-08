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

/** Options for the default Standard engine (multi-view recon; single image passed as one URL). */
export const reconOptionsSchema = z.object({
  resolution: z.union([z.literal(512), z.literal(1024), z.literal(1536)]).default(1024),
  texture_size: z
    .union([z.literal(1024), z.literal(2048), z.literal(4096)])
    .default(2048),
  ss_source: z.enum(["direct", "mesh", "mvtrellis2"]).default("mesh"),
});
export type ReconOptions = z.infer<typeof reconOptionsSchema>;

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
    input_image_path: z.string().min(1),
    options: reconOptionsSchema,
  }),
  z.object({
    model: z.literal("tripo3d/p1/image-to-3d"),
    input_image_path: z.string().min(1),
    options: p1OptionsSchema,
  }),
  z.object({
    model: z.literal("tripo3d/h3.1/image-to-3d"),
    input_image_path: z.string().min(1),
    options: h31OptionsSchema,
  }),
]);
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

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
      "High-detail mesh with baked PBR from a single photo. Slower than the fast tier but strong all-round quality.",
    basePrice: 0,
  },
  "tripo3d/p1/image-to-3d": {
    id: "tripo3d/p1/image-to-3d",
    name: "Tripo P1",
    tagline: "Fast & simple",
    description:
      "Newer, single-knob model. Great default for most images. About a minute per generation.",
    basePrice: 0.4,
  },
  "tripo3d/h3.1/image-to-3d": {
    id: "tripo3d/h3.1/image-to-3d",
    name: "Tripo H3.1",
    tagline: "Higher quality",
    description:
      "Optional HD textures, detailed geometry and quad mesh — more knobs, more cost.",
    basePrice: 0.2,
  },
};

/**
 * Estimate the cost of a generation in USD (Tripo tiers are documented on fal;
 * Standard tier is metered — this is a rough lower bound for UI only).
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
  let cost = 0.2;
  if (req.options.texture === "standard") cost += 0.1;
  if (req.options.texture === "HD") cost += 0.2;
  if (req.options.detailed_geometry) cost += 0.2;
  if (req.options.quad) cost += 0.05;
  return Math.round(cost * 100) / 100;
}

/**
 * Map our internal options to the exact input shape each fal.ai model expects.
 */
export function buildFalInput(
  req: GenerateRequest,
  imageUrl: string,
): Record<string, unknown> {
  if (req.model === "fal-ai/reconviagen-0.5") {
    return {
      image_urls: [imageUrl],
      resolution: req.options.resolution,
      texture_size: req.options.texture_size,
      ss_source: req.options.ss_source,
    };
  }
  if (req.model === "tripo3d/p1/image-to-3d") {
    return {
      image_url: imageUrl,
      texture: req.options.texture,
    };
  }
  return {
    image_url: imageUrl,
    texture: req.options.texture,
    detailed_geometry: req.options.detailed_geometry,
    quad: req.options.quad,
    pbr: req.options.pbr,
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
