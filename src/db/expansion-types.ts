import type { Question } from "./schema";
import { answerExamples } from "./answer-examples";

export type ExpansionCase = readonly [
  difficulty: Question["difficulty"],
  question: string,
  directAnswer: string,
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
    topic.cases.map(([difficulty, question, directAnswer]) => {
      const example = answerExamples[`${topic.category}/${topic.subcategory}`];
      if (!example) {
        throw new Error(
          `Missing worked example: ${topic.category}/${topic.subcategory}`,
        );
      }
      return {
        category: topic.category,
        subcategory: topic.subcategory,
        difficulty,
        question,
        answer: `### 核心结论\n\n${directAnswer}\n\n### 原理与实现\n\n${topic.principle}\n\n### 工程实践与边界\n\n${topic.practice}\n\n### 落地示例与验证\n\n${example}`,
        tags: [topic.category, topic.subcategory],
      };
    }),
  );
}
