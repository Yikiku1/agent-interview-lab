import { z } from "zod";
import { gapKinds, parseLearningScope } from "./learning-contract";
import { parseFilters } from "./question-filters";

export const positiveId = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().max(2147483647));
export const gapLabels = {
  concept: "概念不清",
  expression: "表达不顺",
  evidence: "缺少项目证据",
  follow_up: "追问接不住",
  other: "其他",
} as const;
export const resolveGapPayload = z.strictObject({ resolved: z.boolean() });
export function queryObject(params: URLSearchParams) {
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in result) throw new Error("筛选参数不能重复");
    result[key] = value;
  }
  return result;
}
const gapQuery = z.strictObject({
  kind: z.enum(gapKinds).or(z.literal("")).optional(),
  resolved: z.enum(["true", "false", "all", ""]).optional(),
  preset: z.string().optional(),
  track: z.string().optional(),
  project: z.string().optional(),
  resumePriority: z.string().optional(),
  resumeKind: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard", ""]).optional(),
  status: z.enum(["unmarked", "mastered", "fuzzy", "unknown", ""]).optional(),
  search: z.string().max(100).optional(),
});
export function parseGapQuery(
  input: Record<string, string | string[] | undefined>,
) {
  const parsed = gapQuery.parse(input);
  parseLearningScope(parsed);
  return {
    filters: parseFilters(parsed),
    kind: parsed.kind || undefined,
    resolved:
      parsed.resolved === "all" ? undefined : parsed.resolved === "true",
  };
}
export function gapQueue(
  rows: {
    question: { id: number; active: boolean };
    gap: { resolvedAt: unknown };
  }[],
  size: 3 | 5,
) {
  return [
    ...new Set(
      rows
        .filter((row) => row.question.active && !row.gap.resolvedAt)
        .map((row) => row.question.id),
    ),
  ].slice(0, size);
}
