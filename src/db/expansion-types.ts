import type { Question } from "./schema";
import { getCoreLearningEntry } from "./core-answers";

export type ExpansionCase = readonly [
  difficulty: Question["difficulty"],
  question: string,
  directAnswer: string,
  explanation?: string,
  example?: string,
];

export type ExpansionTopic = {
  category: string;
  subcategory: string;
  principle: string;
  practice: string;
  cases: readonly [ExpansionCase, ExpansionCase, ExpansionCase, ExpansionCase];
};

export function expandTopics(topics: readonly ExpansionTopic[]) {
  return topics.flatMap((topic) =>
    topic.cases.map(
      ([difficulty, question, directAnswer, detail, scenario]) => {
        const core = getCoreLearningEntry(question, topic.category);
        const explanation = detail ?? core?.explanation;
        const example = scenario ?? core?.example;
        if (!explanation || !example) {
          throw new Error(
            `Missing question-specific explanation or example: ${question}`,
          );
        }
        return {
          category: topic.category,
          subcategory: topic.subcategory,
          difficulty,
          question,
          answer: `### 30–60 秒回答\n\n${core?.oral ?? `${directAnswer}${explanation}${example}`}\n\n### 原理与实现\n\n${explanation}\n\n### 落地示例与验证\n\n${example}\n\n### 主题背景（补充）\n\n${topic.principle}\n\n${topic.practice}`,
          tags: [topic.category, topic.subcategory],
        };
      },
    ),
  );
}
