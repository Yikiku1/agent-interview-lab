import type { QuestionStatus } from "@/db/schema";
import type { RoundCompletion } from "@/lib/practice-session";

export const MAX_ANSWER_LENGTH = 10000;

export type PracticeSubmission = {
  attemptId: string;
  status: QuestionStatus;
  answer: string;
};

export type PracticeDraft = {
  version: 1;
  answer: string;
  submission: PracticeSubmission | null;
  completed: boolean;
  failure?: { status: number; message: string };
};

export function parsePracticeDraft(raw: string | null): PracticeDraft | null {
  try {
    const draft = JSON.parse(raw ?? "null");
    if (
      !draft ||
      draft.version !== 1 ||
      typeof draft.answer !== "string" ||
      draft.answer.length > MAX_ANSWER_LENGTH ||
      typeof draft.completed !== "boolean"
    )
      return null;
    const submission = draft.submission;
    if (
      submission !== null &&
      (!submission ||
        typeof submission.attemptId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          submission.attemptId,
        ) ||
        !["unknown", "fuzzy", "mastered"].includes(submission.status) ||
        typeof submission.answer !== "string" ||
        submission.answer !== draft.answer)
    )
      return null;
    if (draft.completed && !submission) return null;
    if (
      draft.failure &&
      (!submission ||
        draft.completed ||
        ![400, 401, 403, 404, 409, 422].includes(draft.failure.status) ||
        typeof draft.failure.message !== "string" ||
        draft.failure.message.length > 500)
    )
      return null;
    return {
      version: 1,
      answer: draft.answer,
      submission: submission
        ? {
            attemptId: submission.attemptId,
            status: submission.status,
            answer: submission.answer,
          }
        : null,
      completed: draft.completed,
      ...(draft.failure
        ? {
            failure: {
              status: draft.failure.status,
              message: draft.failure.message,
            },
          }
        : {}),
    };
  } catch {
    return null;
  }
}

export function emptyPracticeDraft(): PracticeDraft {
  return { version: 1, answer: "", submission: null, completed: false };
}

export function restorePracticeDraft(
  stored: PracticeDraft | null,
  recorded?: RoundCompletion,
): PracticeDraft {
  if (!recorded) return stored ?? emptyPracticeDraft();
  if (
    !stored ||
    (stored.completed && stored.submission?.attemptId !== recorded.attemptId)
  ) {
    const answer = recorded.answer ?? "";
    return {
      version: 1,
      answer,
      completed: true,
      submission: {
        attemptId: recorded.attemptId,
        status: recorded.status,
        answer,
      },
    };
  }
  // A lost response can be recovered from the saved event without submitting again.
  if (
    stored.submission?.attemptId === recorded.attemptId &&
    stored.submission.status === recorded.status &&
    (stored.answer.trim() || null) === recorded.answer
  ) {
    return { ...stored, completed: true, failure: undefined };
  }
  // An explicit new draft (including an empty one) takes precedence over old events.
  return stored;
}

export function practiceDraftKey(questionId: number, roundId?: string) {
  return `practice:answer:${roundId ? roundId + ":" : ""}${questionId}`;
}

// Memory keeps the current draft usable when browser storage is unavailable.
const fallback = new Map<string, string>();
const listeners = new Set<() => void>();

export function getDraftSnapshot(
  questionId: number,
  roundId?: string,
  importLegacy = true,
): string | null {
  const key = practiceDraftKey(questionId, roundId);
  if (fallback.has(key)) return fallback.get(key)!;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw || !roundId || !importLegacy) return raw;
    const old = parsePracticeDraft(
      window.localStorage.getItem(practiceDraftKey(questionId)),
    );
    return old && !old.completed
      ? JSON.stringify({ ...emptyPracticeDraft(), answer: old.answer })
      : null;
  } catch {
    return fallback.get(key) ?? null;
  }
}

export function subscribeDrafts(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) fallback.clear();
    else if (event.key.startsWith("practice:answer:"))
      fallback.delete(event.key);
    else return;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function writePracticeDraft(
  questionId: number,
  draft: PracticeDraft,
  roundId?: string,
): boolean {
  const raw = JSON.stringify(draft);
  const key = practiceDraftKey(questionId, roundId);
  fallback.set(key, raw);
  let persisted = true;
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    persisted = false;
  }
  listeners.forEach((listener) => listener());
  return persisted;
}
