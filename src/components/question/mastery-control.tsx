import { Check, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestionStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

const actions = [
  { status: "unknown", label: "不会", icon: X },
  { status: "fuzzy", label: "模糊", icon: CircleHelp },
  { status: "mastered", label: "掌握", icon: Check },
] as const;

export function MasteryGuide() {
  return (
    <details className="learning-details mastery-guide">
      <summary>自评标准：按独立回答的程度判断</summary>
      <dl className="learning-detail-content flex flex-col gap-3 text-xs leading-6">
        <div>
          <dt className="font-medium text-foreground">不会</dt>
          <dd>无法独立形成关键思路，或主要结论明显错误。</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">模糊</dt>
          <dd>
            能回答部分内容，但遗漏关键要点、需要提示，或无法解释例子与边界。
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">掌握</dt>
          <dd>不看答案能覆盖关键要点，用合理例子解释，并回答基础追问。</dd>
        </div>
      </dl>
    </details>
  );
}

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
