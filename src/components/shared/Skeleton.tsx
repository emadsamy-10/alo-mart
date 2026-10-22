import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-skeleton", className)} />;
}

/** Same footprint as ProductCard, so streaming in the real card causes no shift. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-2.5 shadow-card">
      <Skeleton className="aspect-[4/5] w-full rounded-well" />
      <div className="space-y-2 px-1.5 pb-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/2" />
      </div>
    </div>
  );
}
