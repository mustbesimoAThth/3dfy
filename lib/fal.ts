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
 * Estimate the cost of a generation in USD based on the documented fal.ai prices.
 * - P1: $0.40 base, +$0.10 with textures
 * - H3.1: $0.20 base, +$0.10 standard textures or +$0.20 HD textures,
 *         +$0.20 detailed geometry, +$0.05 quad mesh
 */
export function estimateCost(req: GenerateRequest): number {
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
 * Both Tripo endpoints accept `image_url` plus their own option keys.
 */
export function buildFalInput(
  req: GenerateRequest,
  imageUrl: string,
): Record<string, unknown> {
  if (req.model === "tripo3d/p1/image-to-3d") {
    return {
      image_url: imageUrl,
      texture: req.options.texture,
    };
  }
  return {
    image_url: imageUrl,
    texture: req.options.texture, // 'no' | 'standard' | 'HD'
    detailed_geometry: req.options.detailed_geometry,
    quad: req.options.quad,
    pbr: req.options.pbr,
  };
}

// ---------------------------------------------------------------------------
// Webhook payload (best-effort) — fal posts the model output as-is on success
// ---------------------------------------------------------------------------

export interface FalWebhookSuccessPayload {
  request_id?: string;
  status?: "OK" | "ERROR";
  payload?: TripoOutput;
  error?: string | null;
}

export interface TripoOutput {
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

/**
 * Pull useful artifacts out of fal's response, regardless of which Tripo model.
 */
export function pickArtifacts(out: TripoOutput | undefined) {
  const glb = out?.model_urls?.glb?.url ?? out?.model_mesh?.url ?? null;
  const pbrGlb = out?.model_urls?.pbr_model?.url ?? null;
  const preview = out?.rendered_image?.url ?? null;
  return { glb, pbrGlb, preview };
}
