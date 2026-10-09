import { resumeAgentGroups } from "./resume-agent";
import { resumeRagGroups } from "./resume-rag";
import { resumeEngineeringGroups } from "./resume-engineering";
import { resumeFoundationGroups } from "./resume-foundations";
import { resumeQuestionsFrom } from "./resume-content";

export const resumeGroups = [
  ...resumeAgentGroups,
  ...resumeRagGroups,
  ...resumeEngineeringGroups,
  ...resumeFoundationGroups,
];

export const resumeQuestions = resumeQuestionsFrom(resumeGroups);
