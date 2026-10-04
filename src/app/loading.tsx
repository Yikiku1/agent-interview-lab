export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="正在加载">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-5 w-72 max-w-full rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-28 rounded bg-muted" />
        <div className="h-28 rounded bg-muted" />
        <div className="h-28 rounded bg-muted" />
      </div>
      <div className="h-64 rounded bg-muted" />
    </div>
  );
}
