-- Migration: 002_storage_policies.sql
-- Description: Creates the private 'person-photos' storage bucket and configures
--              RLS policies to restrict upload, download, and deletion to the authenticated owner.

-- 1. Create the private person-photos bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'person-photos',
  'person-photos',
  false,
  5242880, -- 5 MiB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage RLS Policies for 'person-photos'
-- Expected object path pattern: {owner_uuid}/{person_uuid}/{random_file_uuid}.jpg

-- SELECT Policy (Reading photos/generating signed URLs)
DROP POLICY IF EXISTS "person_photos_select_owner" ON storage.objects;
CREATE POLICY "person_photos_select_owner"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'person-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT Policy (Uploading new photos)
DROP POLICY IF EXISTS "person_photos_insert_owner" ON storage.objects;
CREATE POLICY "person_photos_insert_owner"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'person-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE Policy (Replacing photos if ever needed)
DROP POLICY IF EXISTS "person_photos_update_owner" ON storage.objects;
CREATE POLICY "person_photos_update_owner"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'person-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'person-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE Policy (Deleting photos on person removal)
DROP POLICY IF EXISTS "person_photos_delete_owner" ON storage.objects;
CREATE POLICY "person_photos_delete_owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'person-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
