import { resumeAgentGroups } from "./resume-agent";
import { resumeRagGroups } from "./resume-rag";
import { resumeEngineeringGroups } from "./resume-engineering";
import { resumeFoundationGroups } from "./resume-foundations";
import {
  resumeQuestionsFrom,
  resumeQuestionTitle,
  resumeLearningEntry,
} from "./resume-content";
import type { SeedQuestion } from "./seed-data";
import { resumeMetadata } from "../lib/learning-contract";

export const resumeGroups = [
  ...resumeAgentGroups,
  ...resumeRagGroups,
  ...resumeEngineeringGroups,
  ...resumeFoundationGroups,
];

export const resumeQuestions = resumeQuestionsFrom(resumeGroups);

const questionsByTitle = new Map(
  resumeQuestions.map((question) => [question.question, question]),
);
const entriesByTitle = new Map(
  resumeGroups.flatMap((group) =>
    group.entries.map(
      (entry) =>
        [
          resumeQuestionTitle(entry, group.scope),
          resumeLearningEntry(entry, group.sources),
        ] as const,
    ),
  ),
);

// Preserve database edits and unknown entries as Markdown rather than hiding them
// behind a structured answer from a different source version.
export function getResumeLearningEntry(question: SeedQuestion) {
  const source = questionsByTitle.get(question.question);
  if (
    !source ||
    source.category !== question.category ||
    source.subcategory !== question.subcategory ||
    source.answer !== question.answer
  )
    return undefined;
  const metadata = resumeMetadata(question);
  const sourceMetadata = resumeMetadata(source);
  if (
    !metadata ||
    !sourceMetadata ||
    metadata.project !== sourceMetadata.project ||
    metadata.priority !== sourceMetadata.priority ||
    metadata.kind !== sourceMetadata.kind
  )
    return undefined;
  return entriesByTitle.get(question.question);
}
