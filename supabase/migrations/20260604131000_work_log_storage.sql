INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-log-attachments',
  'work-log-attachments',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY work_log_attachments_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'work-log-attachments'
    AND auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR public.is_lecturer_of_group((storage.foldername(name))[1]::uuid)
      OR public.is_student_member_of_group((storage.foldername(name))[1]::uuid)
    )
  );

CREATE POLICY work_log_attachments_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'work-log-attachments'
    AND auth.uid() IS NOT NULL
    AND public.current_user_role() = 'student'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_student_member_of_group((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY work_log_attachments_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'work-log-attachments'
    AND auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR public.is_lecturer_of_group((storage.foldername(name))[1]::uuid)
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );
