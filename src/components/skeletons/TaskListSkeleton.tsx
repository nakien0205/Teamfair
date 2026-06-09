import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TaskListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page chrome */}
      <Card className="overflow-hidden rounded-3xl border-0 shadow-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-[min(100%,34rem)]" />
            </div>
            <Skeleton className="h-12 w-36 rounded-2xl" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <Skeleton className="h-11 rounded-2xl" />
            <Skeleton className="h-11 rounded-2xl" />
            <Skeleton className="h-11 rounded-2xl" />
          </div>
        </CardContent>
      </Card>

      {/* Filter / summary chips */}
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-full" />
        ))}
      </div>

      {/* Task blocks */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="overflow-hidden rounded-3xl border-0 shadow-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-6 w-52 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-[min(100%,42rem)]" />
                  <Skeleton className="h-4 w-[min(100%,28rem)]" />
                </div>

                <div className="grid min-w-[280px] gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 sm:grid-cols-2">
                  <Skeleton className="h-12 rounded-xl" />
                  <Skeleton className="h-12 rounded-xl" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {[1, 2, 3, 4, 5].map((cell) => (
                  <div key={cell} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <Skeleton className="h-3 w-20 rounded-full" />
                    <Skeleton className="mt-3 h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-28 rounded-2xl" />
                <Skeleton className="h-10 w-28 rounded-2xl" />
                <Skeleton className="h-10 w-32 rounded-2xl" />
                <Skeleton className="h-10 w-36 rounded-2xl" />
                <Skeleton className="h-10 w-32 rounded-2xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
