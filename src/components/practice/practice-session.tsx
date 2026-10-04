"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MarkdownAnswer } from "@/components/question/markdown-answer";
import { StatusBadge } from "@/components/question/status-badge";
import { actions, saveProgress } from "@/components/question/status-actions";
import type { Question, QuestionStatus } from "@/db/schema";
import { cn, difficultyLabels } from "@/lib/utils";

type Row = { question: Question; status: QuestionStatus | null };

export function PracticeSession({
  rows,
  initialIndex,
  mode,
}: {
  rows: Row[];
  initialIndex: number;
  mode: "random" | "weak" | "sequential";
}) {
  const [index, setIndex] = useState(initialIndex);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<
    Record<number, QuestionStatus | null>
  >(() => Object.fromEntries(rows.map((row) => [row.question.id, row.status])));
  const current = rows[index];
  const status = statuses[current.question.id] ?? null;

  const go = useCallback(
    (direction: number) => {
      setIndex((currentIndex) =>
        Math.min(rows.length - 1, Math.max(0, currentIndex + direction)),
      );
      setRevealed(false);
    },
    [rows.length],
  );

  const choose = useCallback(
    async (next: QuestionStatus) => {
      if (!revealed || saving) return;
      const id = current.question.id;
      const previous = statuses[id] ?? null;
      setStatuses((old) => ({ ...old, [id]: next }));
      setSaving(true);
      try {
        await saveProgress(id, next);
        toast.success("已记录掌握状态");
      } catch (error) {
        setStatuses((old) => ({ ...old, [id]: previous }));
        toast.error(error instanceof Error ? error.message : "保存失败");
      } finally {
        setSaving(false);
      }
    },
    [current.question.id, revealed, saving, statuses],
  );

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    query.delete("index");
    localStorage.setItem(
      "practice:last",
      JSON.stringify({
        url: `${window.location.pathname}?${query.toString()}`,
        index,
      }),
    );
  }, [index]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
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
      if (event.code === "Space") {
        event.preventDefault();
        setRevealed((value) => !value);
      }
      if (event.key === "1") void choose("unknown");
      if (event.key === "2") void choose("fuzzy");
      if (event.key === "3") void choose("mastered");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choose, go]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {mode === "weak"
              ? "薄弱题复习"
              : mode === "random"
                ? "随机刷题"
                : "顺序刷题"}
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            第 {index + 1} / {rows.length} 题
          </h1>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/practice">
            <RotateCcw className="size-4" />
            重新筛选
          </Link>
        </Button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${((index + 1) / rows.length) * 100}%` }}
        />
      </div>
      <div className="grid min-h-[530px] overflow-hidden rounded-md border border-border bg-surface md:grid-cols-[210px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="grid grid-cols-2 gap-4 border-b border-border bg-muted/50 p-5 text-sm md:block md:border-b-0 md:border-r md:p-6">
          <div className="md:mb-8">
            <p className="text-xs text-muted-foreground">分类</p>
            <p className="mt-1 font-medium">{current.question.category}</p>
            <p className="text-xs text-muted-foreground">
              {current.question.subcategory}
            </p>
          </div>
          <div className="md:mb-8">
            <p className="text-xs text-muted-foreground">难度</p>
            <p className="mt-1 font-medium">
              {difficultyLabels[current.question.difficulty]}
            </p>
          </div>
          <div className="md:mb-8">
            <p className="text-xs text-muted-foreground">当前状态</p>
            <div className="mt-2">
              <StatusBadge status={status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">进度</p>
            <p className="mt-1 font-mono text-sm tabular-nums">
              {index + 1} / {rows.length}
            </p>
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <div className="flex-1 p-5 sm:p-7 lg:p-9">
            <p className="mb-4 font-mono text-xs uppercase text-accent">
              Question {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="max-w-3xl text-xl font-semibold leading-9 sm:text-2xl">
              {current.question.question}
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {current.question.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-8 border-t border-border pt-6">
              <Button
                variant="secondary"
                onClick={() => setRevealed((value) => !value)}
              >
                {revealed ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
                {revealed ? "隐藏答案" : "查看答案"}
              </Button>
              {revealed && (
                <div className="mt-7">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    参考答案
                  </h3>
                  <MarkdownAnswer>{current.question.answer}</MarkdownAnswer>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 sm:px-7 lg:px-9">
            <div className="flex flex-wrap gap-2" aria-label="标记掌握程度">
              {actions.map(({ status: next, label, icon: Icon, style }) => (
                <button
                  key={next}
                  type="button"
                  title={revealed ? `标记为${label}` : "请先查看答案"}
                  disabled={!revealed || saving}
                  onClick={() => void choose(next)}
                  className={cn(
                    "inline-flex h-9 min-w-18 items-center justify-center gap-1.5 rounded-md border bg-surface px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    style,
                    status === next &&
                      "ring-2 ring-current ring-offset-2 ring-offset-surface",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go(-1)}
                disabled={index === 0}
              >
                <ArrowLeft className="size-4" />
                上一题
              </Button>
              <Button
                size="sm"
                onClick={() => go(1)}
                disabled={index === rows.length - 1}
              >
                下一题
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        ← → 切题 · Space 显示答案 · 1 不会 · 2 模糊 · 3 掌握
      </p>
    </div>
  );
}
