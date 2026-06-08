INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-evidence',
  'task-evidence',
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

CREATE POLICY task_evidence_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'task-evidence'
    AND auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR public.is_lecturer_of_group((storage.foldername(name))[1]::uuid)
      OR (
        public.current_user_role() = 'student'
        AND (
          (storage.foldername(name))[3] = auth.uid()::text
          OR public.is_student_leader_of_group((storage.foldername(name))[1]::uuid)
        )
      )
    )
  );

CREATE POLICY task_evidence_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'task-evidence'
    AND auth.uid() IS NOT NULL
    AND public.current_user_role() = 'student'
    AND (storage.foldername(name))[3] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = (storage.foldername(name))[2]::uuid
        AND t.group_id = (storage.foldername(name))[1]::uuid
        AND t.assignee_id = auth.uid()
    )
  );

CREATE POLICY task_evidence_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'task-evidence'
    AND auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR public.is_lecturer_of_group((storage.foldername(name))[1]::uuid)
      OR (storage.foldername(name))[3] = auth.uid()::text
    )
  );
