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
  // Single-image Advanced tier — superseded by the multi-view variant below.
  // Retained in the union so historical job rows still typecheck and render.
  | "tripo3d/h3.1/image-to-3d"
  | "tripo3d/h3.1/multiview-to-3d";

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

export interface JobInputRow {
  id: string;
  job_id: string;
  user_id: string;
  image_path: string;
  position: number;
  created_at: string;
}

export interface JobInputInsert {
  id?: string;
  job_id: string;
  user_id: string;
  image_path: string;
  position: number;
  created_at?: string;
}

// =============================================================
// Gallery (migration 0005)
// =============================================================

export type GalleryVisibility = "private" | "public";
export type GalleryModeration = "pending" | "approved" | "rejected";

export interface ProfileRow {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  display_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileUpdate {
  id?: string;
  display_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GalleryItemRow {
  id: string;
  job_id: string;
  user_id: string;
  title: string;
  description: string;
  visibility: GalleryVisibility;
  moderation: GalleryModeration;
  view_count: number;
  like_count: number;
  comment_count: number;
  reported_count: number;
  created_at: string;
  updated_at: string;
}

export interface GalleryItemInsert {
  id?: string;
  job_id: string;
  user_id: string;
  title: string;
  description?: string;
  visibility?: GalleryVisibility;
  moderation?: GalleryModeration;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  reported_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GalleryItemUpdate {
  title?: string;
  description?: string;
  visibility?: GalleryVisibility;
  moderation?: GalleryModeration;
  updated_at?: string;
}

export interface GalleryLikeRow {
  gallery_item_id: string;
  user_id: string;
  created_at: string;
}

export interface GalleryLikeInsert {
  gallery_item_id: string;
  user_id: string;
  created_at?: string;
}

export interface GalleryCommentRow {
  id: string;
  gallery_item_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface GalleryCommentInsert {
  id?: string;
  gallery_item_id: string;
  user_id: string;
  body: string;
  created_at?: string;
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
      job_inputs: {
        Row: JobInputRow;
        Insert: JobInputInsert;
        Update: Partial<JobInputInsert>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      gallery_items: {
        Row: GalleryItemRow;
        Insert: GalleryItemInsert;
        Update: GalleryItemUpdate;
        Relationships: [];
      };
      gallery_likes: {
        Row: GalleryLikeRow;
        Insert: GalleryLikeInsert;
        Update: Partial<GalleryLikeInsert>;
        Relationships: [];
      };
      gallery_comments: {
        Row: GalleryCommentRow;
        Insert: GalleryCommentInsert;
        Update: Partial<GalleryCommentInsert>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      increment_gallery_view: {
        Args: { item_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      job_status: JobStatus;
      gallery_visibility: GalleryVisibility;
      gallery_moderation: GalleryModeration;
    };
    CompositeTypes: Record<never, never>;
  };
}
