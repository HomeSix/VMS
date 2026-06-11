export default function CmsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-6 w-24 rounded bg-muted animate-pulse" />
        <div className="ml-auto">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
      <div className="h-1 w-full rounded-full bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-violet-500/40" />
      <div className="rounded-xl border bg-card p-6 shadow-xs space-y-4">
        <div className="h-1 w-10 rounded-full bg-emerald-500/40 mb-1" />
        <div className="h-5 w-36 rounded bg-muted animate-pulse" />
        <div className="h-3 w-56 rounded bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 shadow-xs space-y-2">
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              <div className="h-7 w-12 rounded bg-muted animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
