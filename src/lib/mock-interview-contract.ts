import { z } from "zod";
import { gapKinds } from "./learning-contract";

export const mockProjects = ["VendorGuard", "发票实习"] as const;
export const mockCreatePayload = z.strictObject({
  requestId: z.uuid(),
  project: z.enum(mockProjects),
  questionId: z.number().int().positive().max(2147483647),
});
export const mockAnswerFields = z.strictObject({
  answer: z
    .string()
    .max(10000)
    .transform((value) => value.trim()),
  elapsedSeconds: z.number().int().min(0).max(86400),
  gaps: z
    .array(z.enum(gapKinds))
    .max(5)
    .transform((values) => gapKinds.filter((kind) => values.includes(kind))),
  gapNote: z
    .string()
    .max(2000)
    .transform((value) => value.trim()),
});
export const mockActionPayload = mockAnswerFields.extend({
  requestId: z.uuid(),
  expectedRevision: z.number().int().positive().max(2147483647),
  action: z.enum(["draft", "answer", "skip", "finish"]),
  position: z.number().int().min(0).max(4),
});
export type MockActionPayload = z.infer<typeof mockActionPayload>;
export type MockAnswerFields = z.infer<typeof mockAnswerFields>;
export type MockNodeState = "pending" | "answered" | "skipped";
export const mockNodeLabels = [
  "自我介绍 / 职责",
  "主问题",
  "追问 1",
  "追问 2",
  "追问 3",
] as const;
export function nextMockPosition(
  nodes: { position: number; state: MockNodeState }[],
) {
  return (
    nodes
      .filter((node) => node.state === "pending")
      .sort((a, b) => a.position - b.position)[0]?.position ?? null
  );
}
export function mockSummary(
  nodes: { state: MockNodeState; answer: string; gaps: string[] }[],
) {
  return {
    answered: nodes.filter((node) => node.state === "answered").length,
    skipped: nodes.filter((node) => node.state === "skipped").length,
    unanswered: nodes.filter((node) => node.state === "pending").length,
    oralOnly: nodes.filter(
      (node) => node.state === "answered" && !node.answer.trim(),
    ).length,
    expression: nodes.filter((node) => node.gaps.includes("expression")).length,
    evidence: nodes.filter((node) => node.gaps.includes("evidence")).length,
  };
}
export const mockDraftSchema = mockAnswerFields.extend({
  version: z.literal(1),
  baseRevision: z.number().int().positive(),
  pending: mockActionPayload.nullable(),
});
export function mockDraftKey(roundId: string, position: number) {
  return `practice:note:mock:v1:${roundId}:${position}`;
}
