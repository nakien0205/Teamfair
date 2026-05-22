-- Migration to support custom notifications schema.
-- Timestamp: 2026-05-22 13:00:00

-- Create public.notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create an index for recipient_id and is_read to ensure fast lookups
CREATE INDEX IF NOT EXISTS notifications_recipient_id_is_read_idx ON public.notifications (recipient_id, is_read);

-- Enable Row Level Security (RLS) on public.notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies:
-- Select policy: Users can only see their own notifications
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT
  USING (auth.uid() = recipient_id);

-- Update policy: Users can only update their own notifications
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Insert policy: Any authenticated user can insert notifications
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Grant SELECT, INSERT, UPDATE, DELETE permissions on public.notifications to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;
