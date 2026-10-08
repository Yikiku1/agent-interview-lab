import type { CoreLearningEntry } from "@/db/learning-content";
import { MarkdownAnswer } from "@/components/question/markdown-answer";

export function CoreLearningAnswer({ entry }: { entry: CoreLearningEntry }) {
  const sections = [
    ["深入理解", entry.explanation],
    ["最小示例与验证", entry.example],
    ["常见误区", entry.pitfalls.map((point) => `- ${point}`).join("\n")],
    ["常见追问", entry.followUps.map((question) => `- ${question}`).join("\n")],
    ["项目举例提示", entry.projectPrompt],
    [
      "参考资料",
      entry.sources.map(([label, url]) => `- [${label}](${url})`).join("\n"),
    ],
  ];
  return (
    <div className="core-learning-answer">
      <section aria-labelledby="core-oral-title">
        <h3 id="core-oral-title" className="text-sm font-semibold mb-3">
          30–60 秒回答
        </h3>
        <MarkdownAnswer>{entry.oral}</MarkdownAnswer>
      </section>
      <section aria-labelledby="core-points-title">
        <h3 id="core-points-title" className="text-sm font-semibold mb-3">
          回答要点
        </h3>
        <MarkdownAnswer>
          {entry.keyPoints.map((point) => `- ${point}`).join("\n")}
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
