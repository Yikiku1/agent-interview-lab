import { randomUUID } from "node:crypto";
import Link from "next/link";
import { InterviewReviewEditor } from "@/components/interview-review/review-editor";
export const dynamic = "force-dynamic";
export default function NewInterviewReviewPage() {
  return (
    <div className="reading-column page-stack">
      <div>
        <h1 className="page-title">记录一次真实面试</h1>
        <p className="page-description">
          只填写一个实际问题也可保存；岗位名称、回答、卡点和关联题均可之后补充。
        </p>
      </div>
      <Link className="subtle-link" href="/interview-reviews">
        返回复盘列表
      </Link>
      <InterviewReviewEditor
        initial={null}
        defaultDate={new Date().toLocaleDateString("sv-SE", {
          timeZone: "Asia/Shanghai",
        })}
        firstQuestionId={randomUUID()}
      />
    </div>
  );
}
