import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PracticeSession } from "@/components/practice/practice-session";
import { getPracticeQuestions, parseFilters } from "@/lib/questions";

export const dynamic = "force-dynamic";

function shuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let state = seed >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function PracticeSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (name: string) =>
    typeof params[name] === "string" ? (params[name] as string) : undefined;
  const mode =
    get("mode") === "random"
      ? "random"
      : get("mode") === "weak"
        ? "weak"
        : "sequential";
  const filters = parseFilters(params);
  const weak =
    mode === "weak"
      ? get("includeFuzzy") === "1"
        ? "both"
        : "unknown"
      : undefined;
  const result = await getPracticeQuestions(filters, weak);
  const rows =
    mode === "random" ? shuffle(result, Number(get("seed")) || 7919) : result;
  const rawIndex = Number(get("index") ?? 0);
  const initialIndex = Number.isInteger(rawIndex)
    ? Math.max(0, Math.min(rawIndex, rows.length - 1))
    : 0;
  if (rows.length === 0)
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-xl font-semibold">当前条件下没有题目</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          调整分类、难度或状态后再试。
        </p>
        <Button className="mt-6" asChild>
          <Link href="/practice">调整筛选</Link>
        </Button>
      </div>
    );
  return (
    <PracticeSession rows={rows} initialIndex={initialIndex} mode={mode} />
  );
}
