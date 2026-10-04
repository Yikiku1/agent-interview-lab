"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categories, difficultyLabels } from "@/lib/utils";

export default function PracticeSetupPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div>
        <h1 className="text-2xl font-semibold">开始刷题</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          选择训练范围，进入连续刷题。
        </p>
      </div>
      <form
        action="/practice/session"
        onSubmit={(event) => {
          const input = event.currentTarget.elements.namedItem(
            "seed",
          ) as HTMLInputElement;
          input.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
        }}
        className="space-y-6 rounded-md border border-border bg-surface p-5 sm:p-7"
      >
        <input type="hidden" name="seed" defaultValue="" />
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            分类
            <select
              name="category"
              defaultValue=""
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">全部分类</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            难度
            <select
              name="difficulty"
              defaultValue=""
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">全部难度</option>
              {Object.entries(difficultyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            掌握状态
            <select
              name="status"
              defaultValue=""
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">全部状态</option>
              <option value="unmarked">未标记</option>
              <option value="mastered">已掌握</option>
              <option value="fuzzy">模糊</option>
              <option value="unknown">不会</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            刷题模式
            <select
              name="mode"
              defaultValue="sequential"
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="sequential">顺序刷题</option>
              <option value="random">随机刷题</option>
              <option value="weak">错题 / 不会题</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="includeFuzzy"
            value="1"
            defaultChecked
            className="size-4 accent-emerald-700"
          />
          错题模式包含“模糊”题目
        </label>
        <div className="flex justify-end border-t border-border pt-5">
          <Button type="submit">
            开始刷题
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
