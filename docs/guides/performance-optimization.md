# Performance Optimization Guide

## Đã triển khai (Implemented)

### 1. Skeleton Loaders
✅ Tạo reusable skeleton components:
- `Skeleton` base component (ui/skeleton.tsx)
- `DashboardSkeleton` - cho dashboard pages
- `TaskListSkeleton` - cho danh sách tasks  
- `GroupDetailSkeleton` - cho chi tiết nhóm
- `TableSkeleton` - cho tables

✅ Đã áp dụng:
- `StudentOverview.tsx` - thay LoadingDashboard bằng DashboardSkeleton
- `StudentLayout.tsx` - loại bỏ loading spinner
- `LecturerLayout.tsx` - loại bỏ inline skeleton

✅ Cải thiện UX logout:
- Giảm timeout signOut từ 5s xuống 2s
- Thêm loading overlay khi logout
- Không còn "chớp" màn hình

## Cần triển khai tiếp (TODO)

### 2. Replace LoadingPage components
Các file cần cập nhật với skeleton loaders:

```typescript
// Pattern to replace:
{dataLoading ? <LoadingPage /> : null}

// Replace with:
{dataLoading ? <TaskListSkeleton /> : null}  // hoặc skeleton phù hợp
```

**Files cần update:**
- [ ] `StudentMyTasks.tsx` → TaskListSkeleton
- [ ] `StudentWorkLogs.tsx` → TaskListSkeleton  
- [ ] `StudentTaskDetail.tsx` → TaskListSkeleton
- [ ] `StudentTaskSubmit.tsx` → TaskListSkeleton
- [ ] `StudentMyGroup.tsx` → GroupDetailSkeleton
- [ ] `LecturerDashboard.tsx` → DashboardSkeleton
- [ ] Các pages khác có `authLoading` hoặc `dataLoading`

### 3. Code Splitting & Lazy Loading

```typescript
// Implement lazy loading for routes
import { lazy, Suspense } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';

const StudentDashboard = lazy(() => import('@/pages/StudentDashboard'));
const LecturerDashboard = lazy(() => import('@/pages/LecturerDashboard'));

// In routes:
<Route 
  path="/student/dashboard" 
  element={
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentDashboard />
    </Suspense>
  } 
/>
```

**Benefits:**
- Giảm bundle size ban đầu
- Tăng tốc độ load trang đầu tiên (FCP)
- Better user experience với skeleton thay vì blank screen

### 4. Optimize AuthContext

```typescript
// TODO: Implement these optimizations in AuthContext.tsx

// 1. Memoize computed values
const profileData = useMemo(() => ({
  id: profile?.id,
  email: profile?.email,
  role: profile?.role,
  // ...
}), [profile?.id, profile?.email, profile?.role]);

// 2. Debounce profile refetch
const debouncedRefresh = useMemo(
  () => debounce(refreshProfile, 500),
  [refreshProfile]
);

// 3. Cache profile data in sessionStorage
useEffect(() => {
  if (profile) {
    sessionStorage.setItem('user_profile', JSON.stringify(profile));
  }
}, [profile]);
```

### 5. Optimize TeamContext

```typescript
// TODO: Implement in TeamContext.tsx

// 1. Selective re-renders với React.memo
export const TeamProvider = React.memo(({ children }) => {
  // ...
});

// 2. Split context để tránh unnecessary re-renders
// Ví dụ: TeamDataContext (groups, tasks) vs TeamActionsContext (functions)

// 3. Implement virtual scrolling cho large lists
import { useVirtualizer } from '@tanstack/react-virtual';
```

### 6. Image & Asset Optimization

```bash
# TODO: Setup image optimization
npm install sharp
npm install @next/bundle-analyzer

# Optimize images:
- Sử dụng WebP format
- Lazy load images với Intersection Observer
- Add placeholder cho images (blurhash)
```

### 7. Database Query Optimization

**RLS Policies:**
- ✅ Fixed circular dependency in users table
- [ ] Add indexes cho frequently queried columns
- [ ] Review và optimize complex queries
- [ ] Implement query caching với React Query

```sql
-- TODO: Add indexes
CREATE INDEX idx_tasks_assignee ON tasks(assigneeId);
CREATE INDEX idx_work_logs_user ON work_logs(userId);
CREATE INDEX idx_groups_project ON groups(projectId);
```

### 8. Bundle Size Optimization

```bash
# Analyze bundle
npm run build
npm run analyze  # (need to setup)

# Target reductions:
- Tree shaking unused code
- Remove duplicate dependencies
- Optimize icon imports (import individual icons)
```

**Current imports to optimize:**
```typescript
// Bad (imports entire library):
import * as Icons from 'lucide-react';

// Good (tree-shakeable):
import { User, Settings, Home } from 'lucide-react';
```

### 9. React Performance Optimizations

```typescript
// TODO: Apply these patterns

// 1. Memoize expensive computations
const sortedTasks = useMemo(
  () => tasks.sort((a, b) => a.deadline - b.deadline),
  [tasks]
);

// 2. Callback memoization
const handleClick = useCallback(() => {
  // handler logic
}, [dependencies]);

// 3. Component memoization
export default React.memo(MyComponent, (prev, next) => {
  return prev.id === next.id; // custom comparison
});

// 4. Virtualize long lists
import { FixedSizeList } from 'react-window';
```

### 10. Network Optimization

```typescript
// TODO: Implement

// 1. Prefetch data for next page
const prefetchNextPage = () => {
  queryClient.prefetchQuery(['nextPage'], fetchNextPage);
};

// 2. Optimistic updates
const mutation = useMutation(updateTask, {
  onMutate: async (newTask) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['tasks']);
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['tasks']);
    
    // Optimistically update
    queryClient.setQueryData(['tasks'], old => [...old, newTask]);
    
    return { previous };
  },
});

// 3. Implement request deduplication
// 4. Add retry logic với exponential backoff
```

## Metrics to Track

### Before Optimization (Baseline)
- [ ] First Contentful Paint (FCP): ?ms
- [ ] Time to Interactive (TTI): ?ms  
- [ ] Bundle Size: ?MB
- [ ] Number of Requests: ?

### After Optimization (Target)
- [ ] FCP < 1.5s
- [ ] TTI < 3s
- [ ] Bundle Size < 500KB (gzipped)
- [ ] Reduce requests by 30%

## Testing Performance

```bash
# Lighthouse audit
npm run build
npx serve -s dist
# Run Lighthouse in Chrome DevTools

# Bundle analyzer
npm run build -- --stats
npx webpack-bundle-analyzer dist/stats.json
```

## Priority Order

1. ✅ **High**: Skeleton loaders (user-facing improvement)
2. **High**: Code splitting major routes
3. **Medium**: Optimize Context providers
4. **Medium**: Database indexes
5. **Low**: Image optimization
6. **Low**: Advanced React optimizations

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Bundle Analysis](https://webpack.js.org/guides/code-splitting/)
