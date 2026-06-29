-- Add group_id column to notifications
ALTER TABLE public.notifications
  ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Index for group_id lookups
CREATE INDEX idx_notifications_group_id ON public.notifications(group_id);

-- Allow recipients to delete their own notifications
CREATE POLICY "Recipients can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = recipient_id);

SELECT pg_notify('pgrst', 'reload schema');
