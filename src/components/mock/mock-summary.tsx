import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatsStrip } from "@/components/ui/stats-strip";
import { MarkdownAnswer } from "@/components/question/markdown-answer";
import { ResumeLearningAnswer } from "@/components/question/resume-learning-answer";
import { gapLabels } from "@/lib/practice-notes-contract";
import { mockNodeLabels, mockSummary } from "@/lib/mock-interview-contract";
import type { MockRoundView } from "@/lib/mock-interview";

export function MockSummary({ round }: { round: MockRoundView }) {
  const summary = mockSummary(round.nodes);
  return (
    <div className="reading-column page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">项目模拟总结</h1>
          <p className="page-description">
            {round.project} · 本轮已结束，原节点顺序和记录保留
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/mock-interviews">选择下一轮模拟</Link>
        </Button>
      </div>
      <StatsStrip
        metrics={[
          { label: "已答节点", value: summary.answered },
          { label: "已跳过", value: summary.skipped },
          { label: "未答", value: summary.unanswered },
          { label: "口头无简记", value: summary.oralOnly },
        ]}
      />
      <p className="text-sm leading-7 text-muted-foreground">
        表达卡点 {summary.expression} 个节点，需补证据 {summary.evidence}{" "}
        个节点，均来自本人标记。口头无简记只说明没有文字记录，需自行回顾现场表现。
      </p>
      <section aria-label="本轮节点记录" className="flex flex-col gap-4">
        {round.nodes.map((node) => (
          <article
            key={node.position}
            className="panel panel-padding flex flex-col gap-3"
          >
            <p className="text-xs text-muted-foreground">
              {mockNodeLabels[node.position]} ·{" "}
              {node.state === "answered"
                ? "已答"
                : node.state === "skipped"
                  ? "已跳过"
                  : "未答"}{" "}
              · {node.elapsedSeconds} 秒
              {node.parentPosition !== null ? " · 来源：本轮主问题" : ""}
            </p>
            <h2 className="font-medium leading-7 break-words">{node.prompt}</h2>
            <div className="text-sm leading-7 whitespace-pre-wrap break-words">
              {node.answer ||
                (node.state === "answered"
                  ? "口头作答，没有文字简记。"
                  : "没有保存回答文字。")}
            </div>
            {node.state === "pending" && node.answer ? (
              <p className="text-xs text-muted-foreground">
                保留的未答草稿，尚未记为已答。
              </p>
            ) : null}
            {node.gaps.length ? (
              <p className="text-sm">
                本人卡点：{node.gaps.map((kind) => gapLabels[kind]).join("、")}
              </p>
            ) : null}
            {node.gapNote ? (
              <p className="text-sm whitespace-pre-wrap break-words">
                {node.gapNote}
              </p>
            ) : null}
          </article>
        ))}
      </section>
      <section
        className="panel panel-padding"
        aria-labelledby="mock-reference-title"
      >
        <h2 id="mock-reference-title" className="section-title mb-5">
          本轮主问题与追问参考
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          以下为开始本轮时的参考快照。三个追问可结合主问题要点核对；具体经历和证据由本人补充。
        </p>
        {round.reference ? (
          <ResumeLearningAnswer entry={round.reference} />
        ) : null}
      </section>
      <section
        className="panel panel-padding flex flex-col gap-4"
        aria-labelledby="mock-next-title"
      >
        <h2 id="mock-next-title" className="section-title">
          下一步补练
        </h2>
        <p className="text-sm text-muted-foreground">
          回到主问题准备本人例子与证据，或补习同主题基础。点击进入普通练习后，明确完成本题才计入正式覆盖。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link
              prefetch={false}
              href={`/practice/session?mode=sequential&size=3&queue=${round.questionId}`}
            >
              正式练习主问题
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/questions/${round.questionId}/answer-card`}>
              准备我的回答卡
            </Link>
          </Button>
          <Link className="subtle-link" href={`/questions/${round.questionId}`}>
            查看题目与个人卡点
          </Link>
        </div>
        <h3 className="text-sm font-medium">建议关联基础</h3>
        <p className="text-xs text-muted-foreground">
          按主问题所属主题选择已有基础题；这是准备建议。
        </p>
        <ul className="space-y-3">
          {round.foundations.map((question) => (
            <li key={question.id}>
              <Link
                className="subtle-link break-words"
                href={`/questions/${question.id}`}
              >
                {question.question}
              </Link>
            </li>
          ))}
        </ul>
        {round.foundations.length ? (
          <Button variant="secondary" asChild>
            <Link
              prefetch={false}
              href={`/practice/session?mode=sequential&size=3&queue=${round.foundations.map((question) => question.id).join(",")}`}
            >
              补练建议基础
            </Link>
          </Button>
        ) : null}
        <MarkdownAnswer>
          模拟卡点保存在本轮记录中。需要长期跟进时，可进入题目详情，主动保存个人卡点并定向补练。
        </MarkdownAnswer>
      </section>
    </div>
  );
}
