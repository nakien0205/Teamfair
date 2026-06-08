# ✅ Profile Loading Timeout Fix - Checklist

## 📋 Pre-deployment Checklist

### 1. Code Changes Applied
- [x] `src/context/AuthContext.tsx` - Optimized with cache, retry, and non-blocking load
- [x] `src/components/ProtectedRoute.tsx` - Improved loading UI
- [x] `src/pages/LecturerRubricsList.tsx` - Created with proper UI design

### 2. Database Migration Ready
- [x] Migration file created: `supabase/migrations/20260604180000_fix_users_rls_circular_dependency.sql`
- [ ] Migration tested locally (optional)
- [ ] Migration applied to production

### 3. Testing Required

#### A. Initial Page Load
- [ ] Open http://localhost:8080 in incognito
- [ ] Loading spinner appears immediately
- [ ] Loading completes within 1-2 seconds
- [ ] No timeout errors in console

#### B. Login Flow
- [ ] Login with email/password
- [ ] Login with Google OAuth
- [ ] Profile loads without timeout
- [ ] Redirects to correct dashboard based on role

#### C. Navigation
- [ ] Navigate to /lecturer/rubrics
- [ ] Navigate to /student/dashboard
- [ ] Navigate to /lecturer/dashboard
- [ ] All pages load without timeout
- [ ] No repeated profile fetch requests (check Network tab)

#### D. Profile Refresh
- [ ] Call `refreshProfile()` manually (via debug component)
- [ ] Profile updates correctly
- [ ] No timeout errors

#### E. Sign Out
- [ ] Sign out works immediately
- [ ] No timeout on sign out
- [ ] Cache is cleared
- [ ] Redirects to login

#### F. Cache Behavior
- [ ] Open DevTools → Console
- [ ] Look for "[AuthContext] Using cached profile" log
- [ ] Navigate between pages
- [ ] Profile is cached for 30 seconds
- [ ] After 30s, profile is fetched again

#### G. Retry Mechanism
- [ ] Simulate slow network (DevTools → Network → Slow 3G)
- [ ] Reload page
- [ ] Look for "[AuthContext] Retrying profile fetch" logs
- [ ] Profile eventually loads or uses fallback

#### H. Fallback Profile
- [ ] Simulate timeout (block `users` table query)
- [ ] Look for "[AuthContext] Using fallback profile" log
- [ ] Fallback profile has name from `user_metadata`
- [ ] User can still navigate and use app

### 4. Database Verification

#### A. Check Migration Applied
```sql
-- In Supabase SQL Editor
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';
```

Expected: Policy `users_select` should exist with new definition

#### B. Test RLS Policy
```sql
-- Login as a user, then run:
SELECT * FROM public.users WHERE id = auth.uid();
```

Expected: Returns current user's row immediately (no timeout)

#### C. Check Lecturer Access
```sql
-- Login as lecturer, then run:
SELECT u.* 
FROM public.users u
INNER JOIN public.group_members m ON m.student_id = u.id
INNER JOIN public.groups g ON g.id = m.group_id
WHERE g.lecturer_id = auth.uid();
```

Expected: Returns students in lecturer's groups

### 5. Performance Verification

#### A. Network Tab
- [ ] Profile fetch completes in < 500ms (normal network)
- [ ] Only 1 profile fetch on initial load (not multiple)
- [ ] Subsequent navigations use cache (no fetch)

#### B. Console Logs
- [ ] No error logs
- [ ] No timeout warnings (unless intentionally simulated)
- [ ] Cache logs appear after 30s

#### C. User Experience
- [ ] Loading spinner appears < 100ms
- [ ] Page becomes interactive < 1s
- [ ] No visible delay or freeze
- [ ] No error toasts

### 6. Edge Cases

#### A. Slow Network
- [ ] DevTools → Network → Slow 3G
- [ ] Profile loads or uses fallback
- [ ] No error toast
- [ ] User can still interact

#### B. Network Offline
- [ ] DevTools → Network → Offline
- [ ] Appropriate error message
- [ ] No infinite spinner
- [ ] Can retry when back online

#### C. Profile Not in Database
- [ ] New user with no `public.users` row
- [ ] Fallback profile is used
- [ ] User can complete onboarding
- [ ] Profile is created on first update

#### D. Multiple Tabs
- [ ] Open app in 2 tabs
- [ ] Update profile in tab 1
- [ ] Refresh tab 2
- [ ] Profile updates correctly in tab 2

#### E. Session Expiry
- [ ] Let session expire (or manually expire)
- [ ] Reload page
- [ ] Redirects to login
- [ ] No timeout errors

### 7. Production Readiness

#### A. Environment Variables
- [ ] `VITE_SUPABASE_URL` configured
- [ ] `VITE_SUPABASE_ANON_KEY` configured
- [ ] Connection to Supabase works

#### B. Migration Applied
- [ ] Run migration on production database
- [ ] Verify RLS policies updated
- [ ] Test with production data

#### C. Monitoring
- [ ] Sentry configured for error tracking
- [ ] Check Sentry for timeout errors (should be 0)
- [ ] Monitor Supabase logs for slow queries

#### D. Rollback Plan
If issues occur:
```sql
-- Rollback RLS policy (restore old version)
DROP POLICY IF EXISTS users_select ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR (public.current_user_role() = 'lecturer' AND EXISTS (...))
  );
```

### 8. Documentation

- [x] Fix documented in `docs/guides/fix_profile_timeout.md`
- [x] Checklist created
- [x] Debug component created (`DebugProfileStatus.tsx`)
- [x] Test script created (`scripts/test-profile-load.js`)

## 🚀 Deployment Steps

1. **Apply Migration**
   ```bash
   npx supabase db push
   # OR manually in SQL Editor
   ```

2. **Deploy Frontend**
   ```bash
   npm run build
   vercel --prod
   # OR your deployment method
   ```

3. **Verify Production**
   - [ ] Login works
   - [ ] No timeout errors
   - [ ] Profile loads fast
   - [ ] Check Sentry for errors

4. **Monitor**
   - [ ] Watch Sentry for 24 hours
   - [ ] Check Supabase logs
   - [ ] User feedback

## 🐛 Debug Tools

### Enable Debug Component (Development Only)
Add to your layout:
```tsx
import DebugProfileStatus from "@/components/DebugProfileStatus";

// In your component
<DebugProfileStatus />
```

### Test Script
```bash
node scripts/test-profile-load.js
```

### Console Logs to Watch
```
[AuthContext] Using cached profile        ← Cache working
[AuthContext] Retrying profile fetch     ← Retry working
[AuthContext] Using fallback profile     ← Fallback working
[AuthContext] Profile load failed        ← Error (investigate)
```

## 📊 Success Metrics

### Before Fix
- Timeout rate: ~30%+ of loads
- Average load time: 10-15s
- Fallback usage: Rare (only after timeout)
- User complaints: High

### After Fix (Target)
- Timeout rate: <1% (only on extremely slow networks)
- Average load time: <1s (with cache: <100ms)
- Fallback usage: Graceful when needed
- User complaints: None

## ✅ Sign-off

- [ ] All tests passed
- [ ] Migration applied
- [ ] Production verified
- [ ] No errors in monitoring
- [ ] Team notified

**Date:** ___________
**Tested by:** ___________
**Deployed by:** ___________

---

**Status:** 🚧 In Progress
**Last Updated:** June 4, 2026
