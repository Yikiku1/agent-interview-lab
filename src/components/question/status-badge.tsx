import type { QuestionStatus } from "@/db/schema";
import { cn, statusLabels } from "@/lib/utils";

export function StatusBadge({ status }: { status: QuestionStatus | null }) {
  const display = status ?? "unmarked";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded px-2 text-xs font-medium",
        {
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300":
            display === "mastered",
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300":
            display === "fuzzy",
          "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300":
            display === "unknown",
          "bg-muted text-muted-foreground": display === "unmarked",
        },
      )}
    >
      {statusLabels[display]}
    </span>
  );
}
