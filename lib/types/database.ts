export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type JobStatus = "queued" | "in_progress" | "completed" | "failed";

export type FalModelId =
  | "fal-ai/reconviagen-0.5"
  | "tripo3d/p1/image-to-3d"
  | "tripo3d/h3.1/image-to-3d";

export interface JobRow {
  id: string;
  user_id: string;
  model: FalModelId;
  options: Json;
  input_image_path: string;
  fal_request_id: string | null;
  status: JobStatus;
  model_glb_path: string | null;
  model_pbr_glb_path: string | null;
  preview_image_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInsert {
  id?: string;
  user_id: string;
  model: FalModelId;
  options?: Json;
  input_image_path: string;
  fal_request_id?: string | null;
  status?: JobStatus;
  model_glb_path?: string | null;
  model_pbr_glb_path?: string | null;
  preview_image_url?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface JobUpdate {
  id?: string;
  user_id?: string;
  model?: FalModelId;
  options?: Json;
  input_image_path?: string;
  fal_request_id?: string | null;
  status?: JobStatus;
  model_glb_path?: string | null;
  model_pbr_glb_path?: string | null;
  preview_image_url?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: JobRow;
        Insert: JobInsert;
        Update: JobUpdate;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      job_status: JobStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
