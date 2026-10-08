import type { QuestionStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { statusLabels } from "@/lib/utils";

export function StatusBadge({ status }: { status: QuestionStatus | null }) {
  const display = status ?? "unmarked";
  return (
    <Badge className="status-badge" data-status={display}>
      {statusLabels[display]}
    </Badge>
  );
}
