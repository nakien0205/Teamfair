-- Supabase Storage buckets and metadata fields for real file uploads.

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'materials',
  ADD COLUMN IF NOT EXISTS uploader_id uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid ();

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_storage_bucket_chk,
  ADD CONSTRAINT materials_storage_bucket_chk CHECK (
    storage_bucket IS NULL
    OR storage_bucket = 'materials'
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'materials',
    'materials',
    false,
    26214400,
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/zip'
    ]
  ),
  (
    'evidence',
    'evidence',
    false,
    10485760,
    ARRAY[
      'image/png',
      'image/jpeg',
      'image/gif',
      'application/pdf',
      'text/plain'
    ]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_materials_select ON storage.objects;
DROP POLICY IF EXISTS storage_materials_insert ON storage.objects;
DROP POLICY IF EXISTS storage_materials_delete ON storage.objects;
DROP POLICY IF EXISTS storage_evidence_select ON storage.objects;
DROP POLICY IF EXISTS storage_evidence_insert ON storage.objects;
DROP POLICY IF EXISTS storage_evidence_delete ON storage.objects;

CREATE POLICY storage_materials_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'materials'
    AND auth.uid () IS NOT NULL
    AND CASE
      WHEN (storage.foldername (name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        public.is_student_member_of_group (((storage.foldername (name))[1])::uuid)
        OR public.is_lecturer_of_group (((storage.foldername (name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY storage_materials_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'materials'
    AND auth.uid () IS NOT NULL
    AND (storage.foldername (name))[2] = auth.uid ()::text
    AND CASE
      WHEN (storage.foldername (name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        public.is_student_member_of_group (((storage.foldername (name))[1])::uuid)
        OR public.is_lecturer_of_group (((storage.foldername (name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY storage_materials_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'materials'
    AND auth.uid () IS NOT NULL
    AND CASE
      WHEN (storage.foldername (name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        (storage.foldername (name))[2] = auth.uid ()::text
        OR EXISTS (
          SELECT 1
          FROM public.group_members gm
          WHERE gm.group_id = ((storage.foldername (name))[1])::uuid
            AND gm.student_id = auth.uid ()
            AND gm.role = 'Leader'
        )
      ELSE false
    END
  );

CREATE POLICY storage_evidence_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'evidence'
    AND auth.uid () IS NOT NULL
    AND CASE
      WHEN (storage.foldername (name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        public.is_student_member_of_group (((storage.foldername (name))[1])::uuid)
        OR public.is_lecturer_of_group (((storage.foldername (name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY storage_evidence_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence'
    AND auth.uid () IS NOT NULL
    AND (storage.foldername (name))[2] = auth.uid ()::text
    AND CASE
      WHEN (storage.foldername (name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        public.is_student_member_of_group (((storage.foldername (name))[1])::uuid)
        OR public.is_lecturer_of_group (((storage.foldername (name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY storage_evidence_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'evidence'
    AND auth.uid () IS NOT NULL
    AND CASE
      WHEN (storage.foldername (name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        (storage.foldername (name))[2] = auth.uid ()::text
        OR EXISTS (
          SELECT 1
          FROM public.group_members gm
          WHERE gm.group_id = ((storage.foldername (name))[1])::uuid
            AND gm.student_id = auth.uid ()
            AND gm.role = 'Leader'
        )
      ELSE false
    END
  );

DROP POLICY IF EXISTS materials_delete ON public.materials;
CREATE POLICY materials_delete ON public.materials
  FOR DELETE
  USING (
    uploader_id = auth.uid ()
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = materials.group_id
        AND gm.student_id = auth.uid ()
        AND gm.role = 'Leader'
    )
  );
