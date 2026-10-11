import Link from "next/link";
import { LearningTargetForm } from "@/components/practice/learning-target-form";
import { getLearningTarget } from "@/lib/learning-target";
import type { LearningTargetPayload } from "@/lib/learning-contract";

export const dynamic = "force-dynamic";

export default async function LearningTargetPage() {
  const target = await getLearningTarget();
  const initial: Omit<LearningTargetPayload, "requestId"> = target
    ? {
        preset: target.preset,
        projectScope: target.projectScope,
        priority: target.priority,
        dailyMinutes: target.dailyMinutes as 5 | 10 | 20 | 40,
        interviewDate: target.interviewDate,
      }
    : {
        preset: "general_core",
        projectScope: null,
        priority: null,
        dailyMinutes: 20,
        interviewDate: null,
      };
  return (
    <div className="reading-column page-stack">
      <div>
        <Link href="/" className="subtle-link mb-3">
          返回首页
        </Link>
        <h1 className="page-title">训练目标</h1>
        <p className="page-description">
          {target
            ? "按项目和准备时间安排下一轮练习。"
            : "尚未保存目标，当前沿用通用核心推荐。"}
        </p>
      </div>
      <LearningTargetForm
        key={target?.id ?? "unconfigured"}
        initial={initial}
      />
    </div>
  );
}
