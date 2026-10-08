"use client";

import { useState } from "react";
import { Check, LoaderCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { QuestionStatus } from "@/db/schema";
import { MasteryControl } from "@/components/question/mastery-control";
import { Alert } from "@/components/ui/alert";

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
  const router = useRouter();
  const [status, setStatus] = useState<QuestionStatus | null>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  async function choose(next: QuestionStatus) {
    if (saving || disabled) return;
    const previous = status;
    setStatus(next);
    setSaving(true);
    setFeedback(null);
    try {
      await saveProgress(questionId, next);
      setFeedback({ success: true, message: "掌握状态已保存" });
      router.refresh();
    } catch (error) {
      setStatus(previous);
      const message = error instanceof Error ? error.message : "保存失败";
      setFeedback({
        success: false,
        message: `${message}，可以重新选择自评。`,
      });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <MasteryControl
        status={status}
        disabled={saving || disabled}
        onChoose={(next) => void choose(next)}
      />
      <Alert
        tone={feedback ? (feedback.success ? "success" : "danger") : "neutral"}
      >
        {saving ? (
          <LoaderCircle className="animate-spin" />
        ) : feedback?.success ? (
          <Check />
        ) : feedback ? (
          <AlertCircle />
        ) : null}
        <span>
          {saving
            ? "正在保存掌握状态…"
            : (feedback?.message ??
              "只调整掌握状态；完成练习后会安排下次复习。")}
        </span>
      </Alert>
    </div>
  );
}
