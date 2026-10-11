import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { learningTargets, users } from "@/db/schema";
import { DEFAULT_USER_ID } from "@/lib/questions";
import type { LearningTargetPayload } from "@/lib/learning-contract";

export async function getLearningTarget() {
  const [target] = await db
    .select()
    .from(learningTargets)
    .where(
      and(
        eq(learningTargets.userId, DEFAULT_USER_ID),
        eq(learningTargets.active, true),
      ),
    )
    .limit(1);
  return target ?? null;
}

export async function saveLearningTarget(payload: LearningTargetPayload) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${users.id} from ${users} where ${users.id} = ${DEFAULT_USER_ID} for update`,
    );
    const [existing] = await tx
      .select()
      .from(learningTargets)
      .where(
        and(
          eq(learningTargets.userId, DEFAULT_USER_ID),
          eq(learningTargets.requestId, payload.requestId),
        ),
      )
      .limit(1);
    if (existing) {
      const same =
        existing.preset === payload.preset &&
        existing.projectScope === payload.projectScope &&
        existing.priority === payload.priority &&
        existing.dailyMinutes === payload.dailyMinutes &&
        existing.interviewDate === payload.interviewDate;
      return same
        ? { status: 200, target: existing }
        : { status: 409, target: null };
    }
    await tx
      .update(learningTargets)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(learningTargets.userId, DEFAULT_USER_ID),
          eq(learningTargets.active, true),
        ),
      );
    const { requestId, ...config } = payload;
    const [target] = await tx
      .insert(learningTargets)
      .values({ userId: DEFAULT_USER_ID, requestId, ...config })
      .returning();
    return { status: 201, target };
  });
}
