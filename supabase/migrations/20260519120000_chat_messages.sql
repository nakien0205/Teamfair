-- Chat history for the StudentAgentSidebar AI assistant.
-- Scoped by (user_id, group_id) so each group has its own conversation thread.

CREATE TABLE public.chat_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  tool_trace  JSONB,
  reasoning   TEXT,
  used_heavy  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own messages"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_chat_messages_user_group_created
  ON public.chat_messages(user_id, group_id, created_at);
