# setup-api-layer
date: 2026-06-04
status: complete
files_changed:
  - .gitignore
  - supabase/functions/_shared/cors.ts (NEW)
  - supabase/functions/_shared/responses.ts (NEW)
  - supabase/functions/_shared/auth.ts (NEW)
  - supabase/functions/_shared/ratelimit.ts (NEW)
  - supabase/functions/team-api/index.ts (NEW)
  - supabase/functions/delete-user-auth/index.ts (NEW)
  - supabase/migrations/20260604140000_api_layer_invite_security.sql (NEW)
  - src/lib/teamApi.ts (NEW)
  - src/lib/teamApi.test.ts (NEW)
  - src/lib/teamPersistence.ts
  - src/context/TeamContext.tsx
  - src/components/ContributionAnalytics.tsx
  - docs/guides/state_and_data.md
  - docs/guides/how_to_run.md
env_vars_added:
  - SUPABASE_URL (Supabase Edge Function secret)
  - SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY (Supabase Edge Function secret)
  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY (Supabase Edge Function secret)
  - UPSTASH_REDIS_REST_URL (Supabase Edge Function secret)
  - UPSTASH_REDIS_REST_TOKEN (Supabase Edge Function secret)
migrations_added:
  - 20260604140000_api_layer_invite_security.sql
blockers: none
notes:
  - Added `team-api` with authenticated action routes for invite management, invite joining, join request processing, report submission, lecturer evaluations/badge awards, task approval, and contribution snapshot calculation.
  - Added fail-open Upstash rate limiting for Edge Function actions.
  - Restored the missing `delete-user-auth` Edge Function used by account deletion.
  - Tightened invite row selection so normal authenticated users cannot enumerate all invite codes.
  - Invite usage is now consumed only after an auto-join or after approval of an approval-required join request.
