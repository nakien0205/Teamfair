---
name: setup-supabase-storage
description: >
  Set up Supabase Storage for file uploads (materials, task evidence, exports) in Teamfair.
  Trigger when: implementing file storage, enabling uploads, or executing roadmap item P0-2.
---

# P0-2: Supabase Storage for File Uploads

## Context
Teamfair currently stores material and evidence **metadata only** — no actual files are uploaded or downloadable. The `MaterialsSection.tsx` and `KanbanBoard.tsx` components reference file names but have no storage backend. This blocks core functionality for both students and lecturers.

**Priority**: P0 — Critical  
**Effort**: L (Large — ~4-6 hours)  
**Budget**: $0 (included in Supabase free tier, 1GB storage)

## Prerequisites
- Supabase project with Auth configured
- Read `docs/guides/state_and_data.md` — understand `TeamContext` and `teamPersistence.ts` patterns
- Read `docs/guides/student_workspace.md` — understand MaterialsSection and KanbanBoard

## Step-by-Step Instructions

### Step 1: Create Supabase Storage buckets via SQL migration

Create `supabase/migrations/<next_timestamp>_storage_buckets.sql`:

```sql
-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('materials', 'materials', false, 10485760, -- 10MB limit
   ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'image/png', 'image/jpeg', 'image/gif', 'text/plain', 'text/csv',
         'application/zip', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('evidence', 'evidence', false, 5242880, -- 5MB limit
   ARRAY['image/png', 'image/jpeg', 'image/gif', 'application/pdf', 'text/plain'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for materials bucket
-- Students and lecturers in the same group can read materials
CREATE POLICY "Group members can read materials"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'materials'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.group_id = (storage.foldername(name))[1]::uuid
    )
  );

-- Students can upload materials to their group folder
CREATE POLICY "Group members can upload materials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'materials'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.group_id = (storage.foldername(name))[1]::uuid
    )
  );

-- Lecturers and uploaders can delete materials
CREATE POLICY "Lecturers and uploaders can delete materials"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'materials'
    AND auth.uid() IS NOT NULL
    AND (
      -- Owner can delete their own uploads
      (storage.foldername(name))[2] = auth.uid()::text
      OR
      -- Lecturer of the group can delete any material
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = (storage.foldername(name))[1]::uuid
          AND g.lecturer_id = auth.uid()
      )
    )
  );

-- Similar policies for evidence bucket
CREATE POLICY "Group members can read evidence"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.group_id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY "Members can upload evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.group_id = (storage.foldername(name))[1]::uuid
    )
  );
```

**Folder convention**: `{bucket}/{group_id}/{user_id}/{filename}`

### Step 2: Create storage utility functions

Create `src/lib/storage.ts`:

```typescript
import { supabase } from "./supabaseClient";

// File path convention: {group_id}/{user_id}/{timestamp}_{filename}
function buildPath(groupId: string, userId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${groupId}/${userId}/${timestamp}_${sanitized}`;
}

export async function uploadFile(
  bucket: "materials" | "evidence",
  groupId: string,
  userId: string,
  file: File
): Promise<{ path: string; url: string } | { error: string }> {
  const path = buildPath(groupId, userId, file.name);

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  // For private buckets, use createSignedUrl instead:
  // const { data, error: urlError } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

  return { path, url: data.publicUrl };
}

export async function downloadFile(bucket: "materials" | "evidence", path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) { console.error("Download error:", error); return null; }
  return data;
}

export async function deleteFile(bucket: "materials" | "evidence", path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) { console.error("Delete error:", error); return false; }
  return true;
}

export function getSignedUrl(bucket: "materials" | "evidence", path: string, expiresIn = 3600) {
  return supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
}
```

### Step 3: Update `teamPersistence.ts` to store file paths

Add `storage_path` column to the `materials` table (check current schema first). If the materials table only stores metadata, add:

```sql
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'materials';
```

Update the persistence functions to read/write the new column.

### Step 4: Update `MaterialsSection.tsx`

Modify the upload handler to:
1. Call `uploadFile()` from `src/lib/storage.ts`
2. Store the returned `path` in the materials database row
3. Add a download button that calls `getSignedUrl()` and opens it

Modify the delete handler to:
1. Call `deleteFile()` to remove from storage
2. Then delete the database row (existing behavior)

### Step 5: Update `KanbanBoard.tsx` evidence uploads

Similar pattern — when students attach evidence to a task:
1. Upload to the `evidence` bucket
2. Store the path in task metadata

## Verification

- [ ] SQL migration applies without errors
- [ ] File upload works for materials (student and lecturer)
- [ ] File download produces the correct file
- [ ] File delete removes from both storage and database
- [ ] RLS prevents cross-group file access
- [ ] Files respect size limits (10MB materials, 5MB evidence)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes

## Post-Task Logging

Create `docs/tech_stack/setup-supabase-storage.md`:

```markdown
# setup-supabase-storage
date: <today>
status: complete
files_changed:
  - supabase/migrations/<timestamp>_storage_buckets.sql
  - src/lib/storage.ts (NEW)
  - src/lib/teamPersistence.ts
  - src/components/MaterialsSection.tsx
  - src/components/KanbanBoard.tsx
env_vars_added: none (uses existing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)
migrations_added:
  - supabase/migrations/<timestamp>_storage_buckets.sql
blockers: none
notes: Added materials and evidence storage buckets with group-scoped RLS. File paths follow {group_id}/{user_id}/{timestamp}_{filename} convention.
```
