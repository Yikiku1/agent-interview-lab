import type { ResumeLearningEntry } from "@/db/resume-content";
import { MarkdownAnswer } from "@/components/question/markdown-answer";

export function ResumeLearningAnswer({
  entry,
}: {
  entry: ResumeLearningEntry;
}) {
  const sections = [
    ["深入拆解与证据准备", entry.evidence],
    ["简历依据与能力边界", `${entry.basis}\n\n${entry.boundary}`],
    ["连续追问", entry.followUps.map((question) => `- ${question}`).join("\n")],
    ["易错点与表达边界", entry.pitfall],
    ["自评标准", entry.selfAssessment],
    [
      "延伸资料",
      entry.sources.map(([label, url]) => `- [${label}](${url})`).join("\n"),
    ],
  ];
  return (
    <div className="core-learning-answer">
      <div className="rounded-md border border-border bg-muted p-4 text-sm leading-7">
        <p className="font-medium">回答性质：{entry.kind}</p>
        <p className="text-muted-foreground">{entry.boundary}</p>
      </div>
      <section aria-label="60–90 秒回答">
        <h3 className="text-sm font-semibold mb-3">60–90 秒回答</h3>
        <MarkdownAnswer>{entry.oral}</MarkdownAnswer>
      </section>
      <section aria-label="三个回答要点">
        <h3 className="text-sm font-semibold mb-3">三个回答要点</h3>
        <MarkdownAnswer>
          {entry.points.map((point) => `- ${point}`).join("\n")}
        </MarkdownAnswer>
      </section>
      <div className="learning-sections">
        {sections.map(([label, content]) => (
          <details className="learning-details" key={label}>
            <summary>{label}</summary>
            <div className="learning-detail-content">
              <MarkdownAnswer>{content}</MarkdownAnswer>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
