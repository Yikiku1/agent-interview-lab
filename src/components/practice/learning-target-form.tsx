"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LearningScopeFields } from "@/components/question/learning-scope-fields";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { LearningTargetPayload } from "@/lib/learning-contract";

type Config = Omit<LearningTargetPayload, "requestId">;

export function LearningTargetForm({ initial }: { initial: Config }) {
  const router = useRouter();
  const pending = useRef<{ config: string; requestId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="panel panel-padding flex flex-col gap-6"
      aria-busy={saving}
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        const data = new FormData(event.currentTarget);
        const config = {
          preset: data.get("preset"),
          projectScope: data.get("project") || null,
          priority: data.get("resumePriority") || null,
          dailyMinutes: Number(data.get("dailyMinutes")),
          interviewDate: data.get("interviewDate") || null,
        };
        const signature = JSON.stringify(config);
        if (pending.current?.config !== signature)
          pending.current = {
            config: signature,
            requestId: crypto.randomUUID(),
          };
        setSaving(true);
        setError("");
        try {
          const response = await fetch("/api/learning-target", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...config,
              requestId: pending.current.requestId,
            }),
          });
          const result = await response.json();
          if (!response.ok) {
            if (response.status === 409) pending.current = null;
            throw new Error(result.error ?? "保存失败，请重试");
          }
          pending.current = null;
          toast.success(
            result.target.active
              ? "目标已保存，首页推荐已更新"
              : "该请求已保存，当前目标已有后续更新",
          );
          router.refresh();
        } catch (problem) {
          setError(
            problem instanceof Error
              ? problem.message
              : "保存失败，请保留配置并重试",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset disabled={saving} className="flex flex-col gap-6 min-w-0">
        <LearningScopeFields
          prefix="target"
          target
          initial={{
            preset: initial.preset,
            project: initial.projectScope ?? undefined,
            resumePriority: initial.priority ?? undefined,
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="target-minutes">每日练习偏好</FieldLabel>
            <select
              id="target-minutes"
              name="dailyMinutes"
              defaultValue={initial.dailyMinutes}
              className="control"
            >
              {[
                [5, 3],
                [10, 5],
                [20, 10],
                [40, 20],
              ].map(([minutes, size]) => (
                <option key={minutes} value={minutes}>
                  {minutes} 分钟档 · 建议 {size} 题
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="target-date">面试日期（可选）</FieldLabel>
            <input
              id="target-date"
              name="interviewDate"
              type="date"
              defaultValue={initial.interviewDate ?? ""}
              className="control"
            />
          </Field>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          时间档位决定建议题数，实际耗时因题目和语速而异。保存只调整后续推荐，已经开始的轮次继续使用原队列。
        </p>
        {error ? (
          <Alert role="alert" tone="danger">
            {error}
          </Alert>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? "正在保存…" : error ? "重试保存目标" : "保存训练目标"}
        </Button>
      </fieldset>
    </form>
  );
}
