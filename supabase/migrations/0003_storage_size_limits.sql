-- =========================================================================
-- 0003 · Raise file-size limits on `models` and `inputs` buckets
-- =========================================================================
-- Background:
--   Supabase Storage buckets default to the project-wide file-size limit
--   (typically 50 MiB). High-quality `.glb` exports from Tripo H3.1
--   (detailed geometry + HD textures + quad mesh) routinely exceed that and
--   fail our /api/fal-webhook upload with "The object exceeded the maximum
--   allowed size".
--
-- This migration raises the per-bucket limits and pins the allowed mime types.
--
-- IMPORTANT: bucket file_size_limit can NEVER exceed the project-wide cap
-- in Supabase Dashboard → Storage → Settings → "Max file size". Set that to
-- at least 500 MB (or the value below) BEFORE applying this migration, or
-- the bucket cap will be silently clamped down.
-- =========================================================================

-- 500 MB — generous headroom for HD-textured / quad-mesh / detailed-geo glb.
update storage.buckets
set
  file_size_limit = 524288000,                                   -- 500 * 1024 * 1024
  allowed_mime_types = array['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
where id = 'models';

-- 25 MB for input photos — comfortably covers a 48 MP HEIC/JPEG.
update storage.buckets
set
  file_size_limit = 26214400,                                    -- 25 * 1024 * 1024
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'inputs';
