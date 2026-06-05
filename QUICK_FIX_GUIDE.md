# ⚡ Quick Fix Guide - Profile Timeout Issue

## 🚨 Problem
Users see: "Quá thời gian tải profile. Vui lòng làm mới trang (F5)..."

## ✅ Solution (5 Steps)

### Step 1: Apply Database Migration (2 minutes)

**Option A: Supabase CLI (Recommended)**
```bash
npx supabase db push
```

**Option B: Supabase SQL Editor (Manual)**
1. Open https://app.supabase.com → Your Project
2. Click **SQL Editor** in sidebar
3. Click **New Query**
4. Copy and paste this:

```sql
-- Fix circular dependency in users RLS policies
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update_self ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_delete_admin ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (
    auth.uid() = id
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      INNER JOIN public.group_members m ON m.group_id = g.id
      WHERE g.lecturer_id = auth.uid()
        AND m.student_id = users.id
    )
  );

CREATE POLICY users_update_self ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY users_delete_admin ON public.users
  FOR DELETE
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
```

5. Click **Run** (or Ctrl+Enter)
6. ✅ Success message should appear

### Step 2: Verify Migration (30 seconds)

Run this in SQL Editor:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';
```

Expected: You should see 4 policies:
- ✅ `users_select`
- ✅ `users_update_self`
- ✅ `users_update_admin`
- ✅ `users_delete_admin`

### Step 3: Test Locally (1 minute)

```bash
# Start dev server
npm run dev

# Open browser
# http://localhost:8080

# Try:
# 1. Login
# 2. Navigate to /lecturer/rubrics
# 3. Check console - no errors?
```

✅ If no timeout errors → Good to go!

### Step 4: Deploy (2 minutes)

```bash
# Build
npm run build

# Deploy (adjust for your platform)
vercel --prod
# or
npm run deploy
# or
git push origin main  # if auto-deploy
```

### Step 5: Verify Production (1 minute)

1. Open your production URL
2. Login
3. Navigate around
4. ✅ No timeout errors?

## 🎉 Done!

Total time: **~5-10 minutes**

## 🔍 Quick Test

### Test 1: Fast Load
- ✅ Profile loads in < 1 second
- ✅ No spinner for more than 1 second

### Test 2: Navigation
- ✅ Navigate between pages
- ✅ No repeated profile fetches (check Network tab)

### Test 3: Slow Network
- DevTools → Network → Slow 3G
- ✅ Profile loads or uses fallback
- ✅ No error toasts

## ⚠️ If Issues Persist

### Check 1: Migration Applied?
```sql
-- In SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'users';
```
Should show updated policies.

### Check 2: Cache Browser
```bash
# Hard refresh in browser
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

### Check 3: Console Errors?
Open DevTools → Console → Look for:
- ❌ `[AuthContext] Profile load failed` → Check RLS policies
- ❌ `timeout` → Check Supabase connection
- ✅ `[AuthContext] Using cached profile` → Working!

### Check 4: Supabase Connection
```bash
# Test connection
curl https://YOUR_PROJECT.supabase.co/rest/v1/
```
Should return 200 OK.

## 📞 Still Having Issues?

1. **Check docs:** `docs/guides/fix_profile_timeout.md`
2. **Run test:** `node scripts/test-profile-load.js`
3. **Check checklist:** `PROFILE_FIX_CHECKLIST.md`
4. **Read summary:** `PROFILE_FIX_SUMMARY.md`

## 🔄 Rollback (If Needed)

```sql
-- Rollback to old policy (in SQL Editor)
DROP POLICY IF EXISTS users_select ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR (public.current_user_role() = 'lecturer' AND EXISTS (
      SELECT 1 FROM public.groups g
      INNER JOIN public.group_members m ON m.group_id = g.id
      WHERE g.lecturer_id = auth.uid() AND m.student_id = users.id
    ))
  );
```

---

**Last Updated:** June 4, 2026
**Estimated Time:** 5-10 minutes
**Difficulty:** ⭐ Easy
