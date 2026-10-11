import { z } from "zod";
import { parseFilters } from "./question-filters";
import { categories, difficultyLabels, statusLabels } from "./utils";
import { presetLabels } from "./learning-options";
import type { Filters } from "./question-filters";

const querySchema = z.strictObject({
  scope: z.literal("custom").optional(),
  preset: z.string().optional(),
  track: z.string().optional(),
  project: z.string().optional(),
  resumePriority: z.string().optional(),
  resumeKind: z.string().optional(),
  category: z.enum([...categories, ""]).optional(),
  difficulty: z.enum(["easy", "medium", "hard", ""]).optional(),
  status: z.enum(["unmarked", "mastered", "fuzzy", "unknown", ""]).optional(),
  search: z.string().max(100).optional(),
  page: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(2147483647))
    .optional(),
});
export function parseScopeProgressQuery(
  input: Record<string, string | string[] | undefined>,
) {
  const parsed = querySchema.parse(input);
  const { page, scope, ...inputFilters } = parsed;
  // An explicit empty custom scope means all enabled questions; pagination alone keeps the saved target.
  const custom =
    scope === "custom" ||
    Object.values(inputFilters).some((value) => value !== undefined);
  return {
    filters: custom ? parseFilters(inputFilters) : undefined,
    page: page ?? 1,
  };
}
export function scopeProgressLabel(filters: Filters) {
  return [
    filters.preset
      ? filters.preset === "general_core"
        ? "通用核心 · 全部启用题"
        : presetLabels[filters.preset]
      : filters.track
        ? "简历专项"
        : "全部启用题",
    filters.project,
    filters.resumePriority,
    filters.resumeKind,
    filters.category,
    filters.difficulty
      ? difficultyLabels[filters.difficulty as keyof typeof difficultyLabels]
      : undefined,
    filters.status
      ? `自评：${statusLabels[filters.status as keyof typeof statusLabels]}`
      : undefined,
    filters.search ? `题目包含“${filters.search}”` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}
