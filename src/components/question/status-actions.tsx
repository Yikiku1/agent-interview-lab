"use client";

import { useState } from "react";
import { Check, CircleHelp, X } from "lucide-react";
import { toast } from "sonner";
import type { QuestionStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

export const actions = [
  {
    status: "unknown",
    label: "不会",
    icon: X,
    style:
      "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950",
  },
  {
    status: "fuzzy",
    label: "模糊",
    icon: CircleHelp,
    style:
      "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950",
  },
  {
    status: "mastered",
    label: "掌握",
    icon: Check,
    style:
      "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950",
  },
] as const;

export async function saveProgress(questionId: number, status: QuestionStatus) {
  const response = await fetch("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, status }),
  });
  if (!response.ok)
    throw new Error((await response.json()).error ?? "保存失败");
}

export function StatusActions({
  questionId,
  initialStatus,
  disabled = false,
}: {
  questionId: number;
  initialStatus: QuestionStatus | null;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<QuestionStatus | null>(initialStatus);
  const [saving, setSaving] = useState(false);
  async function choose(next: QuestionStatus) {
    if (saving || disabled) return;
    const previous = status;
    setStatus(next);
    setSaving(true);
    try {
      await saveProgress(questionId, next);
      toast.success("已记录掌握状态");
    } catch (error) {
      setStatus(previous);
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-2" aria-label="标记掌握程度">
      {actions.map(({ status: next, label, icon: Icon, style }) => (
        <button
          key={next}
          type="button"
          disabled={saving || disabled}
          onClick={() => choose(next)}
          className={cn(
            "inline-flex h-10 min-w-20 items-center justify-center gap-1.5 rounded-md border bg-surface px-3 text-sm font-medium transition-colors disabled:opacity-60",
            style,
            status === next &&
              "ring-2 ring-current ring-offset-2 ring-offset-background",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
