import { z } from "zod";

export const learningPresets = [
  "general_core",
  "resume_focus",
  "project_story",
  "foundation_fill",
] as const;
export const projectScopes = [
  "VendorGuard",
  "发票实习",
  "综合",
  "技术基础",
] as const;
export const resumePriorities = ["P0", "P1", "P2"] as const;
export const resumeKinds = ["简历实战", "基础关联", "扩展设计"] as const;
export const gapKinds = [
  "concept",
  "expression",
  "evidence",
  "follow_up",
  "other",
] as const;
export const learningRoundSizes = [3, 5, 10, 20] as const;
export const dailyMinuteBands = [5, 10, 20, 40] as const;

export type ProjectScope = (typeof projectScopes)[number];
export type ResumePriority = (typeof resumePriorities)[number];
export type ResumeKind = (typeof resumeKinds)[number];
export type LearningPreset = (typeof learningPresets)[number];
export type GapKind = (typeof gapKinds)[number];
export type LearningRoundSize = (typeof learningRoundSizes)[number];

const questionId = z.number().int().positive().max(2147483647);
const note = z.string().trim().max(2000).default("");

export const learningTargetPayload = z
  .strictObject({
    requestId: z.uuid(),
    preset: z.enum(learningPresets),
    projectScope: z.enum(projectScopes).nullable().default(null),
    priority: z.enum(resumePriorities).nullable().default(null),
    dailyMinutes: z.union(dailyMinuteBands.map((value) => z.literal(value))),
    interviewDate: z.iso.date().nullable().default(null),
  })
  .superRefine((target, ctx) => {
    if (
      target.preset === "general_core" &&
      (target.projectScope || target.priority)
    )
      ctx.addIssue({ code: "custom", message: "通用核心不附带简历范围条件" });
    if (target.preset === "project_story" && target.projectScope === "技术基础")
      ctx.addIssue({ code: "custom", message: "项目讲述只包含项目与综合讲述" });
    if (
      target.preset === "foundation_fill" &&
      target.projectScope &&
      target.projectScope !== "技术基础"
    )
      ctx.addIssue({ code: "custom", message: "基础补齐只包含技术基础" });
  });
export type LearningTargetPayload = z.infer<typeof learningTargetPayload>;

export function roundSizeForMinutes(
  minutes: LearningTargetPayload["dailyMinutes"],
): LearningRoundSize {
  return learningRoundSizes[dailyMinuteBands.indexOf(minutes)];
}

export const learningScopePayload = z
  .strictObject({
    preset: z.enum(learningPresets).optional(),
    track: z.literal("resume").optional(),
    project: z.enum(projectScopes).optional(),
    resumePriority: z.enum(resumePriorities).optional(),
    resumeKind: z.enum(resumeKinds).optional(),
  })
  .superRefine((scope, ctx) => {
    if (
      scope.preset === "general_core" &&
      (scope.track || scope.project || scope.resumePriority || scope.resumeKind)
    )
      ctx.addIssue({ code: "custom", message: "通用核心与简历条件冲突" });
    if (scope.preset === "project_story" && scope.project === "技术基础")
      ctx.addIssue({ code: "custom", message: "项目讲述与技术基础条件冲突" });
    if (
      scope.preset === "foundation_fill" &&
      scope.project &&
      scope.project !== "技术基础"
    )
      ctx.addIssue({ code: "custom", message: "基础补齐与项目条件冲突" });
  })
  .transform((scope) => {
    const resume =
      scope.track ||
      scope.project ||
      scope.resumePriority ||
      scope.resumeKind ||
      (scope.preset && scope.preset !== "general_core");
    return { ...scope, ...(resume ? { track: "resume" as const } : {}) };
  });
export type LearningScope = z.infer<typeof learningScopePayload>;

// W1 will merge these keys with the existing category/difficulty/status/search parser.
export function parseLearningScope(
  input: Record<string, string | string[] | undefined>,
) {
  const scope: Record<string, unknown> = {};
  for (const key of [
    "preset",
    "track",
    "project",
    "resumePriority",
    "resumeKind",
  ])
    if (input[key] !== undefined && input[key] !== "") scope[key] = input[key];
  return learningScopePayload.parse(scope);
}

export function scopeForTarget(target: LearningTargetPayload): LearningScope {
  return learningScopePayload.parse({
    preset: target.preset,
    ...(target.projectScope ? { project: target.projectScope } : {}),
    ...(target.priority ? { resumePriority: target.priority } : {}),
  });
}

export function scopeProjects(scope: LearningScope): readonly ProjectScope[] {
  if (scope.project) return [scope.project];
  if (scope.preset === "project_story") return projectScopes.slice(0, 3);
  if (scope.preset === "foundation_fill") return ["技术基础"];
  return projectScopes;
}

type QuestionMetadata = { tags: readonly string[]; subcategory: string };
export function resumeMetadata(question: QuestionMetadata) {
  if (!question.tags.includes("简历专项")) return null;
  const project = projectScopes.filter((value) =>
    question.tags.includes(value),
  );
  const priority = resumePriorities.filter((value) =>
    question.tags.includes(value),
  );
  const kind = resumeKinds.filter((value) => question.tags.includes(value));
  if (
    project.length !== 1 ||
    priority.length !== 1 ||
    kind.length !== 1 ||
    question.subcategory !== `简历专项 · ${project[0]}`
  )
    return null;
  return { project: project[0], priority: priority[0], kind: kind[0] };
}

export function matchesLearningScope(
  question: QuestionMetadata & { active: boolean },
  scope: LearningScope,
) {
  if (!question.active) return false;
  if (!scope.track) return true;
  const metadata = resumeMetadata(question);
  return (
    metadata !== null &&
    scopeProjects(scope).includes(metadata.project) &&
    (!scope.resumePriority || metadata.priority === scope.resumePriority) &&
    (!scope.resumeKind || metadata.kind === scope.resumeKind)
  );
}

export const personalAnswerCardPayload = z.strictObject({
  questionId,
  expectedRevision: z.number().int().min(0).max(2147483646),
  shortAnswer: z.string().trim().max(10000).default(""),
  example: z.string().trim().max(10000).default(""),
  contributionBoundary: z.string().trim().max(10000).default(""),
  evidence: z.string().trim().max(10000).default(""),
});

export const practiceObservationPayload = z
  .strictObject({
    requestId: z.uuid(),
    questionId,
    reviewEventId: questionId.nullable().default(null),
    pointChecks: z
      .array(
        z.strictObject({
          position: z.number().int().min(0).max(2),
          pointTextSnapshot: z.string().trim().min(1).max(2000),
          covered: z.boolean(),
          note,
        }),
      )
      .max(3)
      .default([]),
    gaps: z
      .array(z.strictObject({ kind: z.enum(gapKinds), note }))
      .max(5)
      .default([]),
  })
  .superRefine((observation, ctx) => {
    if (!observation.pointChecks.length && !observation.gaps.length)
      ctx.addIssue({ code: "custom", message: "至少保存一个要点自查或卡点" });
    if (
      new Set(observation.pointChecks.map((point) => point.position)).size !==
      observation.pointChecks.length
    )
      ctx.addIssue({ code: "custom", message: "要点位置不能重复" });
    if (
      new Set(observation.gaps.map((gap) => gap.kind)).size !==
      observation.gaps.length
    )
      ctx.addIssue({ code: "custom", message: "同一次观察的卡点类型不能重复" });
  })
  .transform((observation) => ({
    ...observation,
    pointChecks: [...observation.pointChecks].sort(
      (a, b) => a.position - b.position,
    ),
    gaps: [...observation.gaps].sort(
      (a, b) => gapKinds.indexOf(a.kind) - gapKinds.indexOf(b.kind),
    ),
  }));
export type PracticeObservationPayload = z.infer<
  typeof practiceObservationPayload
>;
