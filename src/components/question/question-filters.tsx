import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { categories, difficultyLabels } from "@/lib/utils";

export function QuestionFilters({
  filters,
}: {
  filters: {
    search?: string;
    category?: string;
    difficulty?: string;
    status?: string;
  };
}) {
  const active = Object.values(filters).some(Boolean);
  return (
    <form action="/questions" role="search" className="panel filter-bar">
      <Field className="filter-search">
        <FieldLabel htmlFor="question-search">搜索题目</FieldLabel>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="question-search"
            name="search"
            type="search"
            defaultValue={filters.search}
            placeholder="输入关键词"
            className="control pl-9"
          />
        </div>
      </Field>
      <Field>
        <FieldLabel htmlFor="filter-category">分类</FieldLabel>
        <select
          id="filter-category"
          name="category"
          defaultValue={filters.category ?? ""}
          className="control"
        >
          <option value="">全部分类</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor="filter-difficulty">难度</FieldLabel>
        <select
          id="filter-difficulty"
          name="difficulty"
          defaultValue={filters.difficulty ?? ""}
          className="control"
        >
          <option value="">全部难度</option>
          {Object.entries(difficultyLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor="filter-status">掌握状态</FieldLabel>
        <select
          id="filter-status"
          name="status"
          defaultValue={filters.status ?? ""}
          className="control"
        >
          <option value="">全部状态</option>
          <option value="unmarked">未标记</option>
          <option value="mastered">已掌握</option>
          <option value="fuzzy">模糊</option>
          <option value="unknown">不会</option>
        </select>
      </Field>
      <div className="flex items-center gap-1">
        <Button type="submit">筛选</Button>
        {active ? (
          <Button variant="ghost" asChild>
            <Link href="/questions">重置</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
