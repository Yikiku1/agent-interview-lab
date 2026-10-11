import type { Filters } from "./question-filters";

export const presetLabels = {
  general_core: "通用核心",
  resume_focus: "简历重点",
  project_story: "项目讲述",
  foundation_fill: "基础补齐",
} as const;
export const projectLabels = [
  "VendorGuard",
  "发票实习",
  "综合",
  "技术基础",
] as const;
export const priorityLabels = ["P0", "P1", "P2"] as const;
export const kindLabels = ["简历实战", "基础关联", "扩展设计"] as const;

export function filtersQuery(filters: Filters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  return query;
}
