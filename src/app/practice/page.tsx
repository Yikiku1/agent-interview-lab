"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { categories, cn, difficultyLabels } from "@/lib/utils";

const modes = [
  {
    value: "sequential",
    label: "顺序练习",
    description: "按题库顺序，逐步学习",
  },
  { value: "random", label: "随机练习", description: "打乱顺序，检验理解" },
  { value: "weak", label: "薄弱题", description: "优先练习不会的题目" },
  { value: "due", label: "到期复习", description: "按照复习安排巩固" },
];

export default function PracticeSetupPage() {
  const [mode, setMode] = useState("sequential");
  const [starting, setStarting] = useState(false);
  const scheduled = mode === "weak" || mode === "due";
  return (
    <div className="page-stack mx-auto max-w-3xl">
      <div>
        <h1 className="page-title">练习设置</h1>
        <p className="page-description">
          选好范围，专注练一轮。每题都可以写下回答，也可以口头作答。
        </p>
      </div>
      <form
        action="/practice/session"
        onSubmit={(event) => {
          const input = event.currentTarget.elements.namedItem(
            "seed",
          ) as HTMLInputElement;
          input.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
          setStarting(true);
        }}
        className="panel panel-padding flex flex-col gap-6"
        aria-busy={starting}
      >
        <input type="hidden" name="seed" defaultValue="" />
        <FieldSet>
          <FieldLegend>练习范围</FieldLegend>
          <FieldGroup className="sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="practice-category">分类</FieldLabel>
              <select
                id="practice-category"
                name="category"
                defaultValue=""
                className="control"
              >
                <option value="">全部分类</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="practice-difficulty">难度</FieldLabel>
              <select
                id="practice-difficulty"
                name="difficulty"
                defaultValue=""
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
            <Field data-disabled={scheduled || undefined}>
              <FieldLabel htmlFor="practice-status">掌握状态</FieldLabel>
              <select
                id="practice-status"
                name="status"
                defaultValue=""
                className="control"
                disabled={scheduled}
                aria-describedby={scheduled ? "mode-help" : undefined}
              >
                <option value="">全部状态</option>
                <option value="unmarked">未标记</option>
                <option value="mastered">已掌握</option>
                <option value="fuzzy">模糊</option>
                <option value="unknown">不会</option>
              </select>
            </Field>
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>练习模式</FieldLegend>
          <FieldGroup className="gap-3 sm:grid-cols-2">
            {modes.map((item) => (
              <label key={item.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value={item.value}
                  checked={mode === item.value}
                  onChange={() => setMode(item.value)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex min-h-20 flex-col justify-center gap-1 rounded-md border border-border px-4 py-3 transition-colors hover:bg-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                    mode === item.value && "border-accent bg-accent-soft",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      mode === item.value && "text-accent",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </label>
            ))}
          </FieldGroup>
          {mode === "weak" ? (
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="includeFuzzy"
                value="1"
                defaultChecked
                className="size-4"
              />
              同时练习“模糊”题目
            </label>
          ) : null}
          {scheduled ? (
            <FieldDescription id="mode-help" className="mt-3">
              {mode === "due"
                ? "到期题目按复习时间排序，包含已掌握的题目。"
                : "薄弱题按掌握状态筛选，不使用上方的状态条件。"}
            </FieldDescription>
          ) : null}
        </FieldSet>
        <FieldSet>
          <FieldLegend>每轮题数</FieldLegend>
          <div className="segmented-control">
            {[10, 20].map((size) => (
              <label className="segment" key={size}>
                <input
                  type="radio"
                  name="size"
                  value={size}
                  defaultChecked={size === 10}
                  className="sr-only"
                />
                <span>{size} 题</span>
              </label>
            ))}
          </div>
          <FieldDescription className="mt-3">
            符合条件的题目不足时，使用实际题数。
          </FieldDescription>
        </FieldSet>
        <div className="form-footer">
          <p className="text-xs text-muted-foreground">
            先回答 → 对照答案 → 自评并完成
          </p>
          <Button type="submit" disabled={starting}>
            {starting ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : null}
            {starting ? "正在准备题目…" : "开始练习"}
            {starting ? null : <ArrowRight data-icon="inline-end" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
