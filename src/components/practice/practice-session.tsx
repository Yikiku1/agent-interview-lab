"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MarkdownAnswer } from "@/components/question/markdown-answer";
import {
  MasteryControl,
  MasteryGuide,
} from "@/components/question/mastery-control";
import { CoreLearningAnswer } from "@/components/question/core-learning-answer";
import type { CoreLearningEntry } from "@/db/learning-content";
import { StatusBadge } from "@/components/question/status-badge";
import { saveProgress } from "@/components/question/status-actions";
import type { Question, QuestionStatus } from "@/db/schema";
import { cn, difficultyLabels } from "@/lib/utils";
import {
  roundLocation,
  snapshotSession,
  type PracticeMode,
  type RoundCompletion,
} from "@/lib/practice-session";
import { MAX_ANSWER_LENGTH } from "@/lib/practice-draft";
import { reviewDateLabel } from "@/lib/review-schedule";
import { usePracticeAnswer } from "@/components/practice/use-practice-answer";
import { RoundSummary } from "@/components/practice/round-summary";

type Row = { question: Question; status: QuestionStatus | null };
const modeLabels = {
  daily: "今日推荐练习",
  due: "到期复习",
  weak: "薄弱题练习",
  random: "随机练习",
  sequential: "顺序练习",
};

export function PracticeSession({
  rows,
  initialIndex,
  mode,
  roundId,
  initialCompletions,
  initialFinished,
  referenceTime,
  learningEntries,
  skippedCount,
}: {
  rows: Row[];
  initialIndex: number;
  mode: PracticeMode;
  roundId: string;
  initialCompletions: RoundCompletion[];
  initialFinished: boolean;
  referenceTime: number;
  learningEntries: Record<number, CoreLearningEntry>;
  skippedCount: number;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(initialFinished);
  const [lastSaved, setLastSaved] = useState<RoundCompletion | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    questionId: number;
    success: boolean;
    message: string;
  } | null>(null);
  const focusOnNavigate = useRef(false);
  const [completions, setCompletions] = useState<
    Record<number, RoundCompletion>
  >(() =>
    Object.fromEntries(
      initialCompletions.map((item) => [item.questionId, item]),
    ),
  );
  const ids = useMemo(() => rows.map((row) => row.question.id), [rows]);
  const [statuses, setStatuses] = useState<
    Record<number, QuestionStatus | null>
  >(() => Object.fromEntries(rows.map((row) => [row.question.id, row.status])));
  const current = rows[index];
  const status = statuses[current.question.id] ?? null;
  const position = useCallback(
    (nextIndex: number, showSummary = false) => {
      const bounded = Math.min(rows.length - 1, Math.max(0, nextIndex));
      window.history.replaceState(
        null,
        "",
        roundLocation(
          window.location.href,
          roundId,
          ids,
          rows[bounded].question.id,
          showSummary,
        ),
      );
      focusOnNavigate.current = true;
      setIndex(bounded);
      setFinished(showSummary);
      setRevealed(false);
      setStatusFeedback(null);
    },
    [rows, ids, roundId],
  );
  const answer = usePracticeAnswer(
    current.question.id,
    roundId,
    status,
    saving,
    completions[current.question.id],
    (completed) => {
      setStatuses((old) => ({
        ...old,
        [completed.questionId]: completed.status,
      }));
      setCompletions((old) => ({ ...old, [completed.questionId]: completed }));
      setLastSaved(completed);
      if (index === rows.length - 1) position(index, true);
      else position(index + 1);
    },
  );
  const go = useCallback(
    (direction: number) => {
      if (saving || answer.submitting) return;
      if (direction > 0 && index === rows.length - 1) position(index, true);
      else position(index + direction);
    },
    [rows.length, index, position, saving, answer.submitting],
  );
  const choose = useCallback(
    async (next: QuestionStatus) => {
      if (
        saving ||
        answer.submitting ||
        (answer.draft.submission && !answer.draft.completed)
      )
        return;
      const id = current.question.id;
      const previous = statuses[id] ?? null;
      setStatuses((old) => ({ ...old, [id]: next }));
      setSaving(true);
      setStatusFeedback(null);
      try {
        await saveProgress(id, next);
        setStatusFeedback({
          questionId: id,
          success: true,
          message: "自评已保存，完成本题后计入这次练习。",
        });
      } catch (error) {
        setStatuses((old) => ({ ...old, [id]: previous }));
        const message = error instanceof Error ? error.message : "保存失败";
        setStatusFeedback({
          questionId: id,
          success: false,
          message: `${message}，请重新选择自评。`,
        });
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [
      current.question.id,
      saving,
      statuses,
      answer.submitting,
      answer.draft.submission,
      answer.draft.completed,
    ],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        "practice:last",
        JSON.stringify(
          snapshotSession(
            window.location.href,
            rows.map((row) => row.question.id),
            current.question.id,
          ),
        ),
      );
    } catch {
      /* The URL still preserves the current queue and position. */
    }
  }, [rows, current.question.id, finished]);
  useEffect(() => {
    if (!focusOnNavigate.current) return;
    focusOnNavigate.current = false;
    document
      .getElementById(finished ? "round-summary-title" : "question-title")
      ?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [index, finished]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        finished ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
      if (event.code === "Space" && !target.closest("button, a, summary")) {
        event.preventDefault();
        setRevealed((value) => !value);
      }
      if (event.key === "1") void choose("unknown");
      if (event.key === "2") void choose("fuzzy");
      if (event.key === "3") void choose("mastered");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choose, go, finished]);

  if (finished)
    return (
      <RoundSummary
        questions={rows.map((row) => row.question)}
        completions={completions}
        onResume={(id) => position(ids.indexOf(id))}
        referenceTime={referenceTime}
      />
    );

  const busy = saving || answer.submitting;
  const feedback =
    statusFeedback?.questionId === current.question.id ? statusFeedback : null;
  const draftMessage = answer.submitting
    ? "正在保存本次练习，请稍候…"
    : answer.draft.completed
      ? "本题已完成，回答和自评已保存。"
      : answer.draft.failure
        ? `${answer.draft.failure.message}。回答已保留，请恢复编辑后重新提交。`
        : answer.draft.submission
          ? `${answer.saveError ?? "上次保存尚未确认"}。回答已保留，可以重试保存。`
          : !answer.storageAvailable
            ? "草稿暂时无法自动保存，请保持页面打开。"
            : answer.draft.answer
              ? "草稿已自动保存，切题或刷新后可以继续。"
              : "支持口头作答；填写文字会自动保存草稿。";
  const draftTone = answer.submitting
    ? "neutral"
    : answer.draft.completed
      ? "success"
      : answer.draft.failure
        ? "danger"
        : answer.draft.submission || !answer.storageAvailable
          ? "warning"
          : "neutral";

  return (
    <div className="reading-column flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm font-medium">{modeLabels[mode]}</p>
          <p
            className="text-xs tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            已完成 {Object.keys(completions).length} / {rows.length} 题
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => position(index, true)}
          >
            结束本轮
          </Button>
          {busy ? (
            <Button variant="ghost" size="sm" disabled>
              调整范围
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/practice">
                <RotateCcw data-icon="inline-start" />
                调整范围
              </Link>
            </Button>
          )}
        </div>
      </div>
      <Progress
        value={(Object.keys(completions).length / rows.length) * 100}
        label="本轮完成进度"
      />
      {skippedCount > 0 ? (
        <Alert>
          <span>
            本轮有 {skippedCount} 道题已停用，已跳过；实际练习 {rows.length}{" "}
            题。
          </span>
        </Alert>
      ) : null}
      {lastSaved ? (
        <Alert tone="success">
          <Check />
          <span>
            上一题已完成，回答已保存。
            {lastSaved.nextReviewAt
              ? `下次复习：${reviewDateLabel(lastSaved.nextReviewAt)}。`
              : ""}
          </span>
        </Alert>
      ) : null}
      <article
        className="panel practice-panel"
        aria-labelledby="question-title"
      >
        <div className="practice-info">
          <span className="font-medium text-foreground">
            {current.question.category}
          </span>
          <span>{current.question.subcategory}</span>
          <span aria-hidden="true">·</span>
          <span>{difficultyLabels[current.question.difficulty]}</span>
          <StatusBadge status={status} />
          {answer.draft.completed ? <Badge>本题已完成</Badge> : null}
          <span className="ml-auto whitespace-nowrap font-medium tabular-nums text-foreground">
            第 {index + 1} / {rows.length} 题
          </span>
        </div>
        <div className="practice-content">
          <div>
            <h1 id="question-title" tabIndex={-1} className="question-title">
              {current.question.question}
            </h1>
            {current.question.tags.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {current.question.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            ) : null}
          </div>
          <section
            aria-labelledby="answer-label"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                id="answer-label"
                htmlFor="practice-answer"
                className="text-sm font-medium"
              >
                我的回答{" "}
                <span className="font-normal text-muted-foreground">
                  （选填）
                </span>
              </label>
              <span
                id="answer-count"
                className="text-xs tabular-nums text-muted-foreground"
              >
                {answer.draft.answer.length} / {MAX_ANSWER_LENGTH}
              </span>
            </div>
            <textarea
              id="practice-answer"
              value={answer.draft.answer}
              onChange={(event) => answer.updateAnswer(event.target.value)}
              disabled={Boolean(answer.draft.submission)}
              maxLength={MAX_ANSWER_LENGTH}
              rows={6}
              placeholder="先写下思路、关键步骤和例子，再对照参考答案。"
              aria-describedby="answer-note answer-count"
              className="control practice-answer"
            />
            <Alert id="answer-note" tone={draftTone}>
              {answer.submitting ? (
                <LoaderCircle className="animate-spin" />
              ) : answer.draft.completed ? (
                <Check />
              ) : answer.draft.submission || !answer.storageAvailable ? (
                <AlertCircle />
              ) : null}
              <span>{draftMessage}</span>
            </Alert>
          </section>
          <div>
            <Button
              variant="secondary"
              onClick={() => setRevealed((value) => !value)}
              aria-expanded={revealed}
              aria-controls="reference-answer"
            >
              <BookOpen data-icon="inline-start" />
              {revealed ? "收起参考答案" : "展开参考答案"}
              <ChevronDown
                data-icon="inline-end"
                className={cn("transition-transform", revealed && "rotate-180")}
              />
            </Button>
          </div>
          <section
            id="reference-answer"
            hidden={!revealed}
            aria-labelledby="reference-title"
            className={revealed ? "reference-answer" : undefined}
          >
            {revealed ? (
              <>
                <h2 id="reference-title" className="section-title">
                  参考答案
                </h2>
                {learningEntries[current.question.id] ? (
                  <CoreLearningAnswer
                    key={current.question.id}
                    entry={learningEntries[current.question.id]}
                  />
                ) : (
                  <MarkdownAnswer>{current.question.answer}</MarkdownAnswer>
                )}
              </>
            ) : null}
          </section>
        </div>
        <div className="practice-actions">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex w-full flex-col gap-3 sm:w-auto">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">自评</h2>
                <span className="text-xs text-muted-foreground">
                  选择当前的掌握程度
                </span>
              </div>
              <MasteryControl
                className="practice-assessment"
                status={status}
                disabled={
                  busy ||
                  Boolean(answer.draft.submission && !answer.draft.completed)
                }
                onChoose={(next) => void choose(next)}
              />
            </div>
            {answer.draft.failure ? (
              <Button className="practice-complete" onClick={answer.recover}>
                保留回答并恢复编辑
              </Button>
            ) : answer.draft.completed ? (
              <Button
                variant="secondary"
                className="practice-complete"
                onClick={answer.restart}
              >
                <RotateCcw data-icon="inline-start" />
                再练一次
              </Button>
            ) : (
              <Button
                className="practice-complete"
                onClick={() => void answer.complete()}
                disabled={!status || busy}
                aria-busy={answer.submitting}
              >
                {answer.submitting ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                {answer.submitting
                  ? "正在保存…"
                  : answer.draft.submission
                    ? "重试保存"
                    : "完成本题"}
              </Button>
            )}
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            先对照回答要点，再判断能否独立解释例子与边界。仅选择自评不计次数，完成本题后才记录练习。
          </p>
          <MasteryGuide key={current.question.id} />
          <Alert tone={feedback && !feedback.success ? "danger" : "neutral"}>
            {saving ? (
              <LoaderCircle className="animate-spin" />
            ) : feedback?.success ? (
              <Check />
            ) : feedback ? (
              <AlertCircle />
            ) : null}
            <span>
              {saving
                ? "正在保存自评…"
                : (feedback?.message ??
                  (answer.draft.completed
                    ? "本次练习已计入统计。切题可以回看，再练一次可以重新作答。"
                    : !status
                      ? "先选择自评，再完成本题。切题会保留草稿。"
                      : "完成本题会保存回答、记录这次练习，并进入下一题。"))}
            </span>
          </Alert>
          <div className="practice-navigation">
            <Link
              href={`/questions/${current.question.id}#history`}
              prefetch={false}
              className="subtle-link min-h-11"
            >
              回看历史回答
            </Link>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go(-1)}
                disabled={index === 0 || busy}
              >
                <ArrowLeft data-icon="inline-start" />
                上一题
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go(1)}
                disabled={busy}
              >
                {index === rows.length - 1 ? "查看总结" : "下一题"}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </div>
      </article>
      <p className="hidden text-center text-xs text-muted-foreground sm:block">
        ← → 切题 · Space 展开答案 · 1 不会 · 2 模糊 · 3 掌握
      </p>
    </div>
  );
}
