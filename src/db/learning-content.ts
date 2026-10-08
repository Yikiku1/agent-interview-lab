import type { SeedQuestion } from "./seed-data";

export type LearningEntry = {
  question: string;
  oral: string;
  explanation: string;
  example: string;
  followUps: readonly [string, string];
  sources: readonly [label: string, url: string][];
};

export function learningAnswer(entry: LearningEntry): string {
  return [
    "### 30–60 秒回答",
    entry.oral,
    "### 深入理解",
    entry.explanation,
    "### 最小示例与验证",
    entry.example,
    "### 常见追问",
    entry.followUps.map((question) => `- ${question}`).join("\n"),
    "### 参考资料",
    entry.sources.map(([label, url]) => `- [${label}](${url})`).join("\n"),
  ].join("\n\n");
}

export function basicQuestion(
  category: string,
  entry: LearningEntry,
): SeedQuestion {
  return {
    category,
    subcategory: "基础入门",
    difficulty: "easy",
    question: entry.question,
    answer: learningAnswer(entry),
    tags: [category, "基础入门", "基础"],
  };
}
