"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { QuestionStatus } from "@/db/schema";
import {
  emptyPracticeDraft,
  getDraftSnapshot,
  parsePracticeDraft,
  restorePracticeDraft,
  subscribeDrafts,
  writePracticeDraft,
  type PracticeDraft,
} from "@/lib/practice-draft";
import type { RoundCompletion } from "@/lib/practice-session";

const serverSnapshot = () => null;

export function usePracticeAnswer(
  questionId: number,
  roundId: string,
  status: QuestionStatus | null,
  statusSaving: boolean,
  recorded: RoundCompletion | undefined,
  onRecorded: (completion: RoundCompletion) => void,
) {
  const raw = useSyncExternalStore(
    subscribeDrafts,
    () => getDraftSnapshot(questionId, roundId, !recorded),
    serverSnapshot,
  );
  const draft = restorePracticeDraft(parsePracticeDraft(raw), recorded);
  const [submitting, setSubmitting] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saveError, setSaveError] = useState<{
    questionId: number;
    message: string;
  } | null>(null);
  const inFlight = useRef(false);

  function persist(value: PracticeDraft) {
    setStorageAvailable(writePracticeDraft(questionId, value, roundId));
  }

  async function complete() {
    if (
      inFlight.current ||
      statusSaving ||
      draft.completed ||
      draft.failure ||
      !status
    )
      return;
    inFlight.current = true;
    setSaveError(null);
    const submission = draft.submission ?? {
      attemptId: crypto.randomUUID(),
      status,
      answer: draft.answer,
    };
    const pending: PracticeDraft = { ...draft, submission };
    persist(pending);
    setSubmitting(true);
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, roundId, ...submission }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof body?.error === "string" ? body.error : "练习保存失败，请重试";
        if ([400, 401, 403, 404, 409, 422].includes(response.status))
          persist({
            ...pending,
            failure: {
              status: response.status,
              message: message.slice(0, 500),
            },
          });
        throw new Error(message);
      }
      persist({ ...pending, completed: true });
      onRecorded({
        questionId,
        attemptId: submission.attemptId,
        status: submission.status,
        answer: submission.answer.trim() || null,
        nextReviewAt:
          typeof body?.nextReviewAt === "string" ? body.nextReviewAt : null,
      });
      toast.success("本题已完成，回答已保存");
    } catch (error) {
      const message =
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "暂时无法保存";
      setSaveError({ questionId, message });
      toast.error(`${message}，回答已保留`);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return {
    draft,
    submitting,
    storageAvailable,
    saveError: saveError?.questionId === questionId ? saveError.message : null,
    complete,
    updateAnswer: (answer: string) => {
      if (!draft.submission) persist({ ...draft, answer });
    },
    restart: () => {
      if (!inFlight.current) {
        setSaveError(null);
        persist(emptyPracticeDraft());
      }
    },
    recover: () => {
      if (!inFlight.current && draft.failure) {
        setSaveError(null);
        persist({ ...emptyPracticeDraft(), answer: draft.answer });
      }
    },
  };
}
