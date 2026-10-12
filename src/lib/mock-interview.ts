import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  mockNodes,
  mockRoundActions,
  mockRounds,
  questions,
  users,
} from "@/db/schema";
import { getResumeLearningEntry } from "@/db/resume-questions";
import { DEFAULT_USER_ID, questionCondition } from "./questions";
import { resumeMetadata } from "./learning-contract";
import {
  mockActionPayload,
  nextMockPosition,
  type MockActionPayload,
  type mockCreatePayload,
} from "./mock-interview-contract";
import type { z } from "zod";

const ownedRound = (id: string) =>
  and(eq(mockRounds.id, id), eq(mockRounds.userId, DEFAULT_USER_ID));
type Round = typeof mockRounds.$inferSelect;
type Node = typeof mockNodes.$inferSelect;
export function publicMockRound(round: Round, nodes: Node[]) {
  const position = nextMockPosition(nodes);
  return {
    id: round.id,
    project: round.project,
    questionId: round.questionId,
    revision: round.revision,
    endedAt: round.endedAt?.toISOString() ?? null,
    currentPosition: position,
    states: nodes.map((node) => ({
      position: node.position,
      state: node.state,
    })),
    // Pending future prompts and every reference stay on the server until the round ends.
    nodes: nodes
      .filter(
        (node) =>
          round.endedAt || position === null || node.position <= position,
      )
      .map((node) => ({
        position: node.position,
        parentPosition: node.parentPosition,
        sourceQuestionId: node.sourceQuestionId,
        prompt: node.prompt,
        state: node.state,
        answer: node.answer,
        elapsedSeconds: node.elapsedSeconds,
        gaps: node.gaps,
        gapNote: node.gapNote,
      })),
    reference: round.endedAt ? round.reference : null,
    foundations: round.endedAt ? round.foundations : [],
  };
}
export type MockRoundView = ReturnType<typeof publicMockRound>;

export async function getMockChoices() {
  const candidates = await db
    .select()
    .from(questions)
    .where(
      questionCondition({ preset: "resume_focus", resumeKind: "简历实战" }),
    )
    .orderBy(asc(questions.id));
  return candidates.flatMap((question) => {
    const meta = resumeMetadata(question);
    if (
      !meta ||
      (meta.project !== "VendorGuard" && meta.project !== "发票实习") ||
      !getResumeLearningEntry(question)
    )
      return [];
    return [
      {
        id: question.id,
        question: question.question,
        project: meta.project,
        priority: meta.priority,
      },
    ];
  });
}
export async function listMockRounds() {
  return db
    .select({
      id: mockRounds.id,
      project: mockRounds.project,
      endedAt: mockRounds.endedAt,
      createdAt: mockRounds.createdAt,
      question: mockNodes.prompt,
    })
    .from(mockRounds)
    .innerJoin(
      mockNodes,
      and(eq(mockNodes.roundId, mockRounds.id), eq(mockNodes.position, 1)),
    )
    .where(eq(mockRounds.userId, DEFAULT_USER_ID))
    .orderBy(desc(mockRounds.createdAt), desc(mockRounds.id))
    .limit(20);
}
export async function getMockRound(id: string) {
  return db.transaction(
    async (tx) => {
      const [round] = await tx.select().from(mockRounds).where(ownedRound(id));
      if (!round) return null;
      const nodes = await tx
        .select()
        .from(mockNodes)
        .where(eq(mockNodes.roundId, id))
        .orderBy(asc(mockNodes.position));
      return publicMockRound(round, nodes);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function createMockRound(
  payload: z.infer<typeof mockCreatePayload>,
) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, DEFAULT_USER_ID))
      .for("update");
    const [existing] = await tx
      .select()
      .from(mockRounds)
      .where(
        and(
          eq(mockRounds.userId, DEFAULT_USER_ID),
          eq(mockRounds.requestId, payload.requestId),
        ),
      );
    if (existing)
      return {
        status:
          existing.project === payload.project &&
          existing.questionId === payload.questionId
            ? 200
            : 409,
        id: existing.id,
      };
    const [question] = await tx
      .select()
      .from(questions)
      .where(
        and(eq(questions.id, payload.questionId), eq(questions.active, true)),
      )
      .for("share");
    const entry = question && getResumeLearningEntry(question);
    if (
      !question ||
      !entry ||
      entry.kind !== "简历实战" ||
      resumeMetadata(question)?.project !== payload.project
    )
      return { status: 422, id: null };
    const foundations = await tx
      .select({ id: questions.id, question: questions.question })
      .from(questions)
      .where(
        and(
          questionCondition({ preset: "foundation_fill" }),
          eq(questions.category, question.category),
        ),
      )
      .orderBy(asc(questions.id))
      .limit(3);
    // If this category has no linked fundamentals, use the project's existing foundation path.
    const suggestions = foundations.length
      ? foundations
      : await tx
          .select({ id: questions.id, question: questions.question })
          .from(questions)
          .where(questionCondition({ preset: "foundation_fill" }))
          .orderBy(asc(questions.id))
          .limit(3);
    const [round] = await tx
      .insert(mockRounds)
      .values({
        userId: DEFAULT_USER_ID,
        ...payload,
        reference: entry,
        foundations: suggestions,
      })
      .returning();
    const introduction = `请介绍你在${payload.project}中的职责、独立完成的部分，以及复用或协作的边界。请只讲本人能用材料核对的经历。`;
    await tx.insert(mockNodes).values(
      [introduction, question.question, ...entry.followUps].map(
        (prompt, position) => ({
          roundId: round.id,
          userId: DEFAULT_USER_ID,
          sourceQuestionId: question.id,
          position,
          parentPosition: position >= 2 ? 1 : null,
          prompt,
        }),
      ),
    );
    return { status: 201, id: round.id };
  });
}
export async function applyMockAction(id: string, payload: MockActionPayload) {
  return db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(mockRounds)
      .where(ownedRound(id))
      .for("update");
    if (!round) return { status: 404, round: null };
    const nodes = await tx
      .select()
      .from(mockNodes)
      .where(eq(mockNodes.roundId, id))
      .orderBy(asc(mockNodes.position));
    const [previous] = await tx
      .select()
      .from(mockRoundActions)
      .where(
        and(
          eq(mockRoundActions.roundId, id),
          eq(mockRoundActions.requestId, payload.requestId),
        ),
      );
    if (previous)
      return {
        status:
          JSON.stringify(mockActionPayload.parse(previous.payload)) ===
          JSON.stringify(payload)
            ? 200
            : 409,
        round: publicMockRound(round, nodes),
      };
    const position = nextMockPosition(nodes);
    if (
      round.endedAt ||
      round.revision !== payload.expectedRevision ||
      position !== payload.position
    )
      return { status: 409, round: publicMockRound(round, nodes) };
    const node = nodes.find((item) => item.position === position)!;
    if (payload.elapsedSeconds < node.elapsedSeconds)
      return { status: 409, round: publicMockRound(round, nodes) };
    const now = new Date();
    const state =
      payload.action === "answer"
        ? "answered"
        : payload.action === "skip"
          ? "skipped"
          : "pending";
    const [updated] = await tx
      .update(mockNodes)
      .set({
        answer: payload.answer,
        gaps: payload.gaps,
        gapNote: payload.gapNote,
        elapsedSeconds: payload.elapsedSeconds,
        state,
        completedAt: state === "pending" ? null : now,
      })
      .where(and(eq(mockNodes.roundId, id), eq(mockNodes.position, position!)))
      .returning();
    const latestNodes = nodes.map((item) =>
      item.position === position ? updated : item,
    );
    const [latest] = await tx
      .update(mockRounds)
      .set({
        revision: round.revision + 1,
        updatedAt: now,
        endedAt:
          payload.action === "finish" || nextMockPosition(latestNodes) === null
            ? now
            : null,
      })
      .where(ownedRound(id))
      .returning();
    await tx
      .insert(mockRoundActions)
      .values({
        roundId: id,
        userId: DEFAULT_USER_ID,
        requestId: payload.requestId,
        payload,
      });
    return { status: 200, round: publicMockRound(latest, latestNodes) };
  });
}
