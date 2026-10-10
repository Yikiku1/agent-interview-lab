import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { getSeedQuestions } from "../../src/db/seed-data";
import { validateQuestionBank } from "../../src/db/seed-bank";
import {
  learningTargetPayload,
  matchesLearningScope,
  parseLearningScope,
  personalAnswerCardPayload,
  practiceObservationPayload,
  resumeMetadata,
  roundSizeForMinutes,
  scopeForTarget,
} from "../../src/lib/learning-contract";

const bank = getSeedQuestions().map((question) => ({
  ...question,
  active: true,
}));
const count = (input: Parameters<typeof parseLearningScope>[0]) => {
  const scope = parseLearningScope(input);
  return bank.filter((question) => matchesLearningScope(question, scope))
    .length;
};

test("resume scope uses consistent metadata and excludes deceptive titles, ambiguous tags and disabled questions", () => {
  const resume = bank.find((question) => question.tags.includes("简历专项"))!;
  const scope = parseLearningScope({ track: "resume" });
  assert.ok(resumeMetadata(resume));
  assert.equal(
    matchesLearningScope({ ...resume, active: false }, scope),
    false,
  );
  assert.equal(resumeMetadata({ ...resume, subcategory: "普通题" }), null);
  assert.equal(
    resumeMetadata({ ...resume, tags: [...resume.tags, "P2"] }),
    null,
  );
  const renamed = { ...resume, question: "unrelated title" };
  const deceptive = {
    ...bank[0],
    question: "【简历 P0 · VendorGuard】冒充简历题",
  };
  assert.equal(matchesLearningScope(renamed, scope), true);
  assert.equal(matchesLearningScope(deceptive, scope), false);
  assert.equal(bank.filter((question) => resumeMetadata(question)).length, 100);
  assert.throws(
    () =>
      validateQuestionBank(
        bank.map((question) =>
          question === resume
            ? { ...question, tags: [...question.tags, "P2"] }
            : question,
        ),
      ),
    /Resume metadata/,
  );
});

test("all resume projects, priorities and presets compose without treating P0 as difficulty", () => {
  assert.equal(count({}), 670);
  assert.equal(count({ track: "resume" }), 100);
  assert.equal(count({ project: "VendorGuard" }), 60);
  assert.equal(count({ project: "发票实习" }), 13);
  assert.equal(count({ project: "综合" }), 5);
  assert.equal(count({ project: "技术基础" }), 22);
  assert.equal(count({ resumePriority: "P0" }), 63);
  assert.equal(count({ resumePriority: "P1" }), 32);
  assert.equal(count({ resumePriority: "P2" }), 5);
  assert.equal(count({ preset: "project_story" }), 78);
  assert.equal(count({ preset: "foundation_fill" }), 22);
  const expected = bank.filter(
    (question) =>
      question.tags.includes("VendorGuard") &&
      question.tags.includes("P0") &&
      question.tags.includes("简历实战"),
  );
  assert.equal(
    count({
      project: "VendorGuard",
      resumePriority: "P0",
      resumeKind: "简历实战",
    }),
    expected.length,
  );
  assert.ok(expected.some((question) => question.difficulty !== "easy"));
});

test("legacy filter input stays unrestricted while invalid resume input cannot silently broaden the scope", () => {
  assert.deepEqual(
    parseLearningScope({ category: "Agent", size: "10", search: "简历" }),
    {},
  );
  const params = new URLSearchParams(
    "project=%E5%8F%91%E7%A5%A8%E5%AE%9E%E4%B9%A0&resumePriority=P0",
  );
  assert.deepEqual(parseLearningScope(Object.fromEntries(params)), {
    project: "发票实习",
    resumePriority: "P0",
    track: "resume",
  });
  for (const input of [
    { project: "unknown" },
    { project: ["VendorGuard", "综合"] },
    { resumePriority: "easy" },
    { preset: "general_core", resumePriority: "P0" },
    { preset: "project_story", project: "技术基础" },
    { preset: "foundation_fill", project: "VendorGuard" },
  ])
    assert.throws(() => parseLearningScope(input));
});

test("targets validate calendar dates and time bands without changing saved scope or promising completion time", () => {
  const requestId = randomUUID();
  const target = learningTargetPayload.parse({
    requestId,
    preset: "resume_focus",
    projectScope: "综合",
    priority: "P0",
    dailyMinutes: 5,
    interviewDate: "2028-02-29",
  });
  assert.deepEqual(scopeForTarget(target), {
    preset: "resume_focus",
    project: "综合",
    resumePriority: "P0",
    track: "resume",
  });
  assert.equal(target.interviewDate, "2028-02-29");
  assert.deepEqual(
    [5, 10, 20, 40].map((dailyMinutes) =>
      roundSizeForMinutes(
        learningTargetPayload.parse({
          requestId,
          preset: "general_core",
          dailyMinutes,
        }).dailyMinutes,
      ),
    ),
    [3, 5, 10, 20],
  );
  for (const change of [
    { dailyMinutes: 15 },
    { interviewDate: "2027-02-29" },
    { interviewDate: "2026-10-09T00:00:00Z" },
    { preset: "general_core" },
    { preset: "project_story", projectScope: "技术基础" },
  ])
    assert.equal(
      learningTargetPayload.safeParse({ ...target, ...change }).success,
      false,
    );
});

test("personal cards allow empty evidence and require a revision instead of accepting fabricated ownership", () => {
  const card = personalAnswerCardPayload.parse({
    questionId: 1,
    expectedRevision: 0,
    shortAnswer: "  我的短答  ",
  });
  assert.equal(card.shortAnswer, "我的短答");
  assert.equal(card.evidence, "");
  for (const change of [
    { expectedRevision: -1 },
    { evidence: "x".repeat(10001) },
    { userId: "other" },
    { questionId: 0 },
  ])
    assert.equal(
      personalAnswerCardPayload.safeParse({ ...card, ...change }).success,
      false,
    );
});

test("observations canonicalize reordered checks and gaps so retries compare the original payload", () => {
  const payload = {
    requestId: randomUUID(),
    questionId: 1,
    reviewEventId: 5,
    pointChecks: [
      { position: 2, pointTextSnapshot: "  证据边界  ", covered: false },
      { position: 0, pointTextSnapshot: "关键概念", covered: true },
    ],
    gaps: [{ kind: "evidence", note: "  需要代码例子  " }, { kind: "concept" }],
  };
  const first = practiceObservationPayload.parse(payload);
  const retry = practiceObservationPayload.parse({
    ...payload,
    pointChecks: [...payload.pointChecks].reverse(),
    gaps: [...payload.gaps].reverse(),
  });
  assert.deepEqual(first, retry);
  assert.equal(first.pointChecks[1].pointTextSnapshot, "证据边界");
  assert.equal(first.gaps[1].note, "需要代码例子");
  assert.equal(
    practiceObservationPayload.parse({
      requestId: randomUUID(),
      questionId: 1,
      gaps: [{ kind: "expression" }],
    }).reviewEventId,
    null,
  );
});

test("observation validation rejects empty saves, duplicate entries and excessive or invalid snapshots", () => {
  const base = { requestId: randomUUID(), questionId: 1 };
  for (const input of [
    base,
    { ...base, gaps: [{ kind: "concept" }, { kind: "concept" }] },
    { ...base, gaps: [{ kind: "score" }] },
    { ...base, gaps: [{ kind: "concept", note: "x".repeat(2001) }] },
    {
      ...base,
      pointChecks: [{ position: 0, pointTextSnapshot: " ", covered: true }],
    },
    {
      ...base,
      pointChecks: Array(2).fill({
        position: 0,
        pointTextSnapshot: "要点",
        covered: true,
      }),
    },
    {
      ...base,
      pointChecks: [{ position: 3, pointTextSnapshot: "要点", covered: true }],
    },
  ])
    assert.equal(practiceObservationPayload.safeParse(input).success, false);
});
