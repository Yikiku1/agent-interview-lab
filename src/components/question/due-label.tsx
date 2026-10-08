import { Clock3 } from "lucide-react";
import { reviewDateLabel } from "@/lib/review-schedule";

export function DueLabel({
  at,
  prefix = "下次复习",
  now,
}: {
  at: Date | string | null;
  prefix?: string;
  now?: number;
}) {
  const date = at ? new Date(at) : null;
  const due = date !== null && now !== undefined && date.getTime() <= now;
  return (
    <span className="due-label" data-due={due}>
      <Clock3 className="size-3.5" aria-hidden="true" />
      {date
        ? `${due ? "已到期" : prefix} · ${reviewDateLabel(date)}`
        : "待完成首次练习"}
    </span>
  );
}
