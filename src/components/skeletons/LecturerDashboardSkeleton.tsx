import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LecturerDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4 p-6 md:p-8">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-32 rounded-full bg-white/15" />
              <Skeleton className="h-7 w-52 rounded-full bg-white/15" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-10 w-[min(100%,34rem)] rounded-2xl bg-white/15" />
              <Skeleton className="h-4 w-[min(100%,40rem)] rounded-xl bg-white/10" />
              <Skeleton className="h-4 w-[min(100%,36rem)] rounded-xl bg-white/10" />
              <Skeleton className="h-4 w-[min(100%,28rem)] rounded-xl bg-white/10" />
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-11 w-52 rounded-xl bg-white/15" />
              <Skeleton className="h-11 w-40 rounded-xl bg-white/10" />
            </div>
          </div>

          <div className="grid gap-3 bg-white/5 p-6 md:p-8 lg:border-l lg:border-white/10">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl bg-white/15" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40 rounded-xl bg-white/15" />
                  <Skeleton className="h-3 w-44 rounded-xl bg-white/10" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl bg-white/15" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36 rounded-xl bg-white/15" />
                  <Skeleton className="h-3 w-40 rounded-xl bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-36 rounded-lg" />
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-6">
          <Skeleton className="h-6 w-72 rounded-xl" />
        </div>
        <div className="space-y-0">
          <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_1fr_0.9fr_1fr_72px] gap-4 bg-muted px-4 py-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-4 rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[1.3fr_0.8fr_0.7fr_1fr_0.9fr_1fr_72px] items-center gap-4 border-t border-border px-4 py-4">
              <Skeleton className="h-5 w-40 rounded-xl" />
              <Skeleton className="h-4 w-20 rounded-xl" />
              <Skeleton className="h-4 w-10 rounded-xl justify-self-center" />
              <div className="flex items-center justify-center gap-2">
                <Skeleton className="h-2 w-16 rounded-full" />
                <Skeleton className="h-4 w-8 rounded-xl" />
              </div>
              <Skeleton className="h-4 w-12 rounded-xl justify-self-center" />
              <div className="flex justify-center">
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
              <div className="flex justify-center">
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border border-border shadow-card">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-56 rounded-xl" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-32 rounded-xl" />
                    <Skeleton className="h-4 w-10 rounded-xl" />
                  </div>
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border shadow-card">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-32 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-md" />
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <Skeleton className="h-4 w-full rounded-xl" />
              <Skeleton className="h-4 w-[92%] rounded-xl" />
              <Skeleton className="h-4 w-[84%] rounded-xl" />
              <Skeleton className="h-4 w-[70%] rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
