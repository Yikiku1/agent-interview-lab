import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getSeedQuestions } from "../src/db/seed-data";
import { coreLearningEntries } from "../src/db/core-answers";
import { resumeGroups } from "../src/db/resume-questions";
import { agentTopics } from "../src/db/expansion-agent";
import { llmTopics } from "../src/db/expansion-llm";
import { ragTopics } from "../src/db/expansion-rag";
import { appTopics } from "../src/db/expansion-app";
import { foundationTopics } from "../src/db/expansion-foundations";
import { appliedTopics } from "../src/db/expansion-applied";
import { resumeAgentGroups } from "../src/db/resume-agent";
import { resumeRagGroups } from "../src/db/resume-rag";
import { resumeEngineeringGroups } from "../src/db/resume-engineering";
import { resumeFoundationGroups } from "../src/db/resume-foundations";
import {
  answerSections as sections,
  plainAnswerText as plain,
  effectiveCharacters as characters,
  oralDraftRange,
} from "../src/db/answer-quality";

type Source = "original" | "expansion" | "basic" | "core" | "resume";

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => arg !== "--compare-db" && !arg.startsWith("--output="))
  )
    throw new Error(
      "支持 --compare-db 与 --output=文件路径；请在项目根目录运行",
    );
  const output = args.find((arg) => arg.startsWith("--output="))?.slice(9);
  const bank = getSeedQuestions();
  const expansionFiles = {
    "expansion-agent": agentTopics,
    "expansion-llm": llmTopics,
    "expansion-rag": ragTopics,
    "expansion-app": appTopics,
    "expansion-foundations": foundationTopics,
    "expansion-applied": appliedTopics,
  };
  const sourceFiles = new Map<string, string>();
  for (const [file, topics] of Object.entries(expansionFiles))
    for (const topic of topics)
      for (const entry of topic.cases)
        sourceFiles.set(entry[1], `src/db/${file}.ts`);
  for (const [file, groups] of Object.entries({
    "resume-agent": resumeAgentGroups,
    "resume-rag": resumeRagGroups,
    "resume-engineering": resumeEngineeringGroups,
    "resume-foundations": resumeFoundationGroups,
  }))
    for (const group of groups)
      for (const entry of group.entries)
        sourceFiles.set(
          `【简历 ${entry.priority} · ${group.scope}】${entry.question}`,
          `src/db/${file}.ts`,
        );

  const structuredPoints = new Map<string, readonly string[]>([
    ...coreLearningEntries.map((entry): [string, readonly string[]] => [
      entry.question,
      entry.keyPoints,
    ]),
    ...resumeGroups.flatMap((group) =>
      group.entries.map((entry): [string, readonly string[]] => [
        `【简历 ${entry.priority} · ${group.scope}】${entry.question}`,
        entry.points,
      ]),
    ),
  ]);
  const repeated = new Map<string, { heading: string; questions: string[] }>();
  const details = bank.map((row) => {
    const parts = sections(row.answer);
    const source: Source = row.tags.includes("简历专项")
      ? "resume"
      : row.tags.includes("核心精修")
        ? "core"
        : row.subcategory === "基础入门"
          ? "basic"
          : sourceFiles.has(row.question)
            ? "expansion"
            : "original";
    const oral = parts.find((part) =>
      ["30–60 秒回答", "60–90 秒回答思路", "核心结论"].includes(part.heading),
    );
    const oralCharacters = characters(oral?.text ?? "");
    // A screening assumption, not a recorded reading time or a quality score.
    const screeningMinimum = source === "resume" ? 180 : 90;
    const draftRange = oralDraftRange(source === "resume");
    for (const part of parts) {
      if (characters(part.text) < 40) continue;
      const key = `${part.heading}\n${plain(part.text)}`;
      const group = repeated.get(key) ?? {
        heading: part.heading,
        questions: [],
      };
      group.questions.push(row.question);
      repeated.set(key, group);
    }
    return {
      question: row.question,
      category: row.category,
      source,
      sourceFile:
        source === "core"
          ? "src/db/core-answers.ts"
          : source === "basic"
            ? "src/db/basic-questions.ts"
            : (sourceFiles.get(row.question) ?? "src/db/seed-data.ts"),
      rawMarkdownCharacters: row.answer.length,
      effectiveTextCharacters: characters(row.answer),
      oralHeading: oral?.heading ?? null,
      oralCharacters,
      screeningMinimum,
      belowScreeningMinimum: oralCharacters < screeningMinimum,
      draftRange,
      outsideDraftRange:
        oralCharacters < draftRange.minimum ||
        oralCharacters > draftRange.maximum,
      estimatedSeconds: {
        fast: Math.round((oralCharacters / 4) * 10) / 10,
        slow: Math.round((oralCharacters / 3) * 10) / 10,
      },
      explanationCharacters: parts
        .filter((part) =>
          /深入理解|原理与实现|逐题讲解与场景|深入拆解与回答要点/.test(
            part.heading,
          ),
        )
        .reduce((sum, part) => sum + characters(part.text), 0),
      directivePointCandidates: (
        structuredPoints.get(row.question) ?? []
      ).filter((point) =>
        /^(?:先描述|逐一讲|准备|重点说明|用.+解释选型|比较.+时关注|以.+为例说明|面试时|回答时)/.test(
          point,
        ),
      ),
    };
  });
  const distributions = Object.fromEntries(
    (["original", "expansion", "basic", "core", "resume"] as Source[]).map(
      (source) => {
        const group = details.filter((row) => row.source === source);
        const oral = group
          .map((row) => row.oralCharacters)
          .sort((a, b) => a - b);
        return [
          source,
          {
            count: group.length,
            belowScreeningMinimum: group.filter(
              (row) => row.belowScreeningMinimum,
            ).length,
            oralRange: [oral[0] ?? null, oral.at(-1) ?? null],
            oralMedian: oral[Math.floor(oral.length / 2)] ?? null,
            rawMarkdownRange: group.length
              ? [
                  Math.min(...group.map((row) => row.rawMarkdownCharacters)),
                  Math.max(...group.map((row) => row.rawMarkdownCharacters)),
                ]
              : [],
            effectiveTextRange: group.length
              ? [
                  Math.min(...group.map((row) => row.effectiveTextCharacters)),
                  Math.max(...group.map((row) => row.effectiveTextCharacters)),
                ]
              : [],
          },
        ];
      },
    ),
  );
  const repeatedSections = [...repeated.values()].filter(
    (group) => group.questions.length > 1,
  );
  const repeatedContentSummary = [
    "原理与实现",
    "工程实践与边界",
    "落地示例与验证",
    "岗位场景中的验证",
    "逐题讲解与场景",
    "最小示例与验证",
    "主题背景（补充）",
  ].map((heading) => {
    const groups = repeatedSections.filter(
      (group) => group.heading === heading,
    );
    return {
      heading,
      groups: groups.length,
      affectedQuestions: new Set(groups.flatMap((group) => group.questions))
        .size,
      largestGroup: Math.max(
        0,
        ...groups.map((group) => group.questions.length),
      ),
    };
  });
  let databaseComparison: object | null = null;
  if (args.includes("--compare-db")) {
    const [{ default: postgres }, { databaseUrl }] = await Promise.all([
      import("postgres"),
      import("../src/db/config"),
    ]);
    const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    try {
      const live = await client<
        { question: string; answer: string }[]
      >`select question, answer from questions where active order by id`;
      const source = new Map(bank.map((row) => [row.question, row.answer]));
      const liveTitles = new Set(live.map((row) => row.question));
      databaseComparison = {
        activeQuestions: live.length,
        missingFromSource: live
          .filter((row) => !source.has(row.question))
          .map((row) => row.question),
        missingFromDatabase: bank
          .filter((row) => !liveTitles.has(row.question))
          .map((row) => row.question),
        answerDifferences: live
          .filter(
            (row) =>
              source.has(row.question) &&
              source.get(row.question) !== row.answer,
          )
          .map((row) => row.question),
      };
    } finally {
      await client.end();
    }
  }
  const report = {
    auditedAt: new Date().toISOString(),
    countingRule:
      "Unicode letters and numbers; omit headings, Markdown syntax, code blocks and URL targets; retain link labels. English letters count as characters, not spoken syllables.",
    timingAssumption:
      "3–4 effective text characters per second; screening only, no timed reading verified.",
    summary: {
      total: details.length,
      distributions,
      belowScreeningMinimum: details.filter((row) => row.belowScreeningMinimum)
        .length,
      outsideDraftRange: details.filter((row) => row.outsideDraftRange).length,
      repeatedContentSummary,
      databaseComparison,
    },
    details,
    repeatedSections,
  };
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(() => {
  console.error(
    "答案审查未完成；请检查命令参数、源码和数据库连接。此脚本只读取数据库。",
  );
  process.exitCode = 1;
});
