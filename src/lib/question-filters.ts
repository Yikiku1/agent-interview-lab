import { isCategory } from "@/lib/utils";
import {
  parseLearningScope,
  type LearningScope,
} from "@/lib/learning-contract";

export type Filters = LearningScope & {
  category?: string;
  difficulty?: string;
  status?: string;
  search?: string;
};

export function parseFilters(
  input: Record<string, string | string[] | undefined>,
): Filters {
  const get = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : undefined;
  const category = get("category");
  const difficulty = get("difficulty");
  const status = get("status");
  return {
    ...parseLearningScope(input),
    category: category && isCategory(category) ? category : undefined,
    difficulty:
      difficulty && ["easy", "medium", "hard"].includes(difficulty)
        ? difficulty
        : undefined,
    status:
      status && ["unmarked", "mastered", "fuzzy", "unknown"].includes(status)
        ? status
        : undefined,
    search: get("search")?.trim().slice(0, 100) || undefined,
  };
}
