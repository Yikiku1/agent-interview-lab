import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const categories = [
  "Agent",
  "LLM",
  "RAG",
  "LLM 应用工程",
  "Python",
  "后端",
  "数据库",
] as const;
export const difficultyLabels = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
} as const;
export const statusLabels = {
  mastered: "已掌握",
  fuzzy: "模糊",
  unknown: "不会",
  unmarked: "未标记",
} as const;
export type DisplayStatus = keyof typeof statusLabels;

export function isCategory(
  value: string,
): value is (typeof categories)[number] {
  return categories.includes(value as (typeof categories)[number]);
}
