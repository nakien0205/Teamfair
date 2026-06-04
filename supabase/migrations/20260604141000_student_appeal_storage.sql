INSERT INTO storage.buckets (id, name, public)
VALUES ('student-appeals', 'student-appeals', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "student_appeals_read" ON storage.objects;
CREATE POLICY "student_appeals_read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'student-appeals'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "student_appeals_upload" ON storage.objects;
CREATE POLICY "student_appeals_upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'student-appeals'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "student_appeals_delete" ON storage.objects;
CREATE POLICY "student_appeals_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'student-appeals'
  AND auth.uid() IS NOT NULL
);
