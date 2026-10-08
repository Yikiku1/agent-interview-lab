import { Check, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestionStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

const actions = [
  { status: "unknown", label: "不会", icon: X },
  { status: "fuzzy", label: "模糊", icon: CircleHelp },
  { status: "mastered", label: "掌握", icon: Check },
] as const;

export function MasteryControl({
  status,
  disabled,
  onChoose,
  className,
}: {
  status: QuestionStatus | null;
  disabled?: boolean;
  onChoose: (status: QuestionStatus) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="自评掌握程度"
      className={cn("flex gap-2", className)}
    >
      {actions.map(({ status: next, label, icon: Icon }) => (
        <Button
          key={next}
          variant="assessment"
          data-status={next}
          aria-pressed={status === next}
          disabled={disabled}
          onClick={() => onChoose(next)}
        >
          <Icon data-icon="inline-start" />
          {label}
        </Button>
      ))}
    </div>
  );
}
