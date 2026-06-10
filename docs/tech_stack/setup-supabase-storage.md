# setup-supabase-storage
date: 2026-06-04
status: complete
files_changed:
  - supabase/migrations/20260604120000_storage_buckets.sql
  - src/lib/storage.ts
  - src/lib/teamPersistence.ts
  - src/context/TeamContext.tsx
  - src/components/MaterialsSection.tsx
  - src/components/KanbanBoard.tsx
  - src/lib/workspaceSnapshot.ts
  - src/lib/teamPersistence.test.ts
  - src/lib/storage.test.ts
env_vars_added: none
migrations_added:
  - supabase/migrations/20260604120000_storage_buckets.sql
notes: Added private Supabase Storage buckets for materials and evidence. Upload paths follow {group_id}/{user_id}/{timestamp}_{filename}. Materials are limited to 25MB and evidence to 10MB. File deletion is restricted to Project Leaders and original uploaders.
