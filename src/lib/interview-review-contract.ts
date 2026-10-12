import { z } from "zod";
import { gapKinds } from "./learning-contract";

const questionFields = {
  id: z.uuid(),
  prompt: z.string().trim().min(1).max(10000),
  answerSummary: z.string().trim().max(10000),
  gaps: z
    .array(z.enum(gapKinds))
    .max(5)
    .transform((values) => gapKinds.filter((kind) => values.includes(kind))),
  gapNote: z.string().trim().max(2000),
  improvement: z.string().trim().max(10000),
  questionId: z.number().int().positive().max(2147483647).nullable(),
};
const fields = {
  interviewDate: z.iso.date(),
  name: z.string().trim().max(200),
  note: z.string().trim().max(4000),
  questions: z.array(z.strictObject(questionFields)).min(1).max(20),
};
const uniqueQuestions = (value: { questions: { id: string }[] }) =>
  new Set(value.questions.map((row) => row.id)).size === value.questions.length;
export const reviewCreatePayload = z
  .strictObject({ ...fields, requestId: z.uuid() })
  .refine(uniqueQuestions, "问题标识不能重复");
export const reviewUpdatePayload = z
  .strictObject({
    ...fields,
    requestId: z.uuid(),
    expectedRevision: z.number().int().positive().max(2147483647),
  })
  .refine(uniqueQuestions, "问题标识不能重复");
export type ReviewCreatePayload = z.infer<typeof reviewCreatePayload>;
export type ReviewUpdatePayload = z.infer<typeof reviewUpdatePayload>;
export type ReviewFields = Omit<ReviewCreatePayload, "requestId">;

// Unfinished text may be empty and must retain its whitespace until explicitly saved.
export const reviewFormFields = z.strictObject({
  interviewDate: z.string().max(10),
  name: z.string().max(200),
  note: z.string().max(4000),
  questions: z
    .array(
      z.strictObject({
        ...questionFields,
        prompt: z.string().max(10000),
        answerSummary: z.string().max(10000),
        improvement: z.string().max(10000),
        gapNote: z.string().max(2000),
      }),
    )
    .min(1)
    .max(20),
});
export const reviewDraftSchema = z.strictObject({
  version: z.literal(1),
  baseRevision: z.number().int().positive().nullable(),
  fields: reviewFormFields,
  labels: z.record(z.string(), z.string().max(10000)),
  pending: z.union([reviewCreatePayload, reviewUpdatePayload]).nullable(),
});
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export function reviewDraftKey(id?: string) {
  return `practice:note:interview-review:v1:${id ?? "create"}`;
}
export function reviewPracticeState(
  questionId: number | null,
  active: boolean | null,
  practiced: boolean,
) {
  return questionId === null
    ? "unlinked"
    : practiced
      ? "practiced"
      : !active
        ? "inactive"
        : "pending";
}
export const reviewPracticeLabels = {
  unlinked: "未关联题库",
  practiced: "关联后已正式练过",
  inactive: "关联题已停用",
  pending: "待正式补练",
};
export function reviewPracticeQueue(
  rows: {
    questionId: number | null;
    active: boolean | null;
    practiced: boolean;
  }[],
  size: 3 | 5,
) {
  return [
    ...new Set(
      rows
        .filter(
          (row) => row.questionId !== null && row.active && !row.practiced,
        )
        .map((row) => row.questionId!),
    ),
  ].slice(0, size);
}
export function mergeReviewFields(
  server: ReviewFields,
  local: ReviewFields,
): ReviewFields {
  const localById = new Map(local.questions.map((row) => [row.id, row]));
  const savedIds = new Set(server.questions.map((row) => row.id));
  return {
    ...local,
    questions: [
      ...server.questions.map((row) => localById.get(row.id) ?? row),
      ...local.questions.filter((row) => !savedIds.has(row.id)),
    ],
  };
}
