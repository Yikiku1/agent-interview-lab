import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="reading-column page-stack"
      role="status"
      aria-label="正在加载页面"
    >
      <span className="sr-only">正在加载页面…</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="panel panel-padding flex flex-col gap-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-11 w-32" />
      </div>
    </div>
  );
}
