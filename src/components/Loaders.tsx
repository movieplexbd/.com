export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-muted relative overflow-hidden ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(220 14% 92%) 50%, hsl(var(--muted)) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s linear infinite",
      }}
    />
  );
}

export function MovieRowSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="px-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex gap-3 overflow-hidden px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-[120px] shrink-0 space-y-1.5">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
