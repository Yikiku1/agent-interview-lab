import assert from "node:assert/strict";
import { test } from "node:test";
import { getSeedQuestions, retiredQuestionTexts } from "../../src/db/seed-data";
import { basicQuestions } from "../../src/db/basic-questions";
import {
  coreAnswers,
  coreLearningEntries,
  getCoreLearningEntry,
} from "../../src/db/core-answers";
import { coreCategoryOrder, corePath } from "../../src/db/core-path";
import { learningAnswer } from "../../src/db/learning-content";
import { validateQuestionBank } from "../../src/db/seed-bank";
import { resumeQuestions } from "../../src/db/resume-questions";

test("670 questions preserve 570 originals and include 100 resume questions", () => {
  const rows = getSeedQuestions();
  validateQuestionBank(rows);
  assert.equal(rows.length, 670);
  assert.equal(new Set(rows.map((row) => row.question)).size, 670);
  assert.equal(resumeQuestions.length, 100);
  assert.equal(basicQuestions.length, 70);
  assert.equal(Object.keys(coreAnswers).length, 30);
  assert.equal(
    rows.filter((row) => !row.tags.includes("简历专项")).length,
    570,
  );
  assert.equal(
    rows.filter(
      (row) => row.difficulty === "easy" && !row.tags.includes("简历专项"),
    ).length,
    84,
  );
  assert.equal(
    rows.some((row) => retiredQuestionTexts.includes(row.question)),
    false,
  );
  for (const category of new Set(basicQuestions.map((row) => row.category))) {
    assert.equal(
      basicQuestions.filter((row) => row.category === category).length,
      10,
    );
  }
});

test("new and refined answers contain answer points, examples, follow-ups and sources", () => {
  const rows = getSeedQuestions().filter(
    (row) => row.subcategory === "基础入门" || row.tags.includes("核心精修"),
  );
  assert.equal(rows.length, 100);
  for (const row of rows) {
    for (const heading of [
      "30–60 秒回答",
      "深入理解",
      "最小示例与验证",
      "常见追问",
      "参考资料",
    ]) {
      assert.ok(
        row.answer.includes(`### ${heading}`),
        `${row.question}: missing ${heading}`,
      );
    }
    assert.match(row.answer, /\]\(https:\/\//);
  }
});

test("bank validation rejects duplicates before any database write", () => {
  const rows = getSeedQuestions();
  rows[1] = rows[0];
  assert.throws(() => validateQuestionBank(rows), /unique/);
});

test("all 30 core entries map uniquely to the original bank, with actionable layers and ordered themes", () => {
  const rows = getSeedQuestions();
  assert.equal(coreLearningEntries.length, 30);
  assert.equal(new Set(corePath.map((entry) => entry.key)).size, 30);
  assert.deepEqual(
    [...new Set(corePath.map((entry) => entry.category))],
    [...coreCategoryOrder],
  );
  for (const entry of coreLearningEntries) {
    const matches = rows.filter((row) => row.question === entry.question);
    assert.equal(matches.length, 1, entry.question);
    assert.equal(matches[0].category, entry.category);
    assert.ok(matches[0].tags.includes("核心精修"));
    assert.equal(matches[0].answer, learningAnswer(entry));
    assert.ok(entry.keyPoints.length >= 3 && entry.keyPoints.length <= 5);
    assert.ok(entry.pitfalls.length >= 1 && entry.pitfalls.length <= 2);
    assert.equal(new Set(entry.keyPoints).size, entry.keyPoints.length);
    for (const text of [
      ...entry.keyPoints,
      ...entry.pitfalls,
      entry.projectPrompt,
    ])
      assert.ok(text.trim().length >= 10, `${entry.question}: ${text}`);
    assert.equal(entry.followUps.length, 2);
    for (const [label, url] of entry.sources) {
      assert.ok(label);
      assert.equal(new URL(url).protocol, "https:");
    }
    for (const text of [
      entry.oral,
      entry.explanation,
      entry.example,
      entry.projectPrompt,
      ...entry.keyPoints,
      ...entry.pitfalls,
      ...entry.followUps,
    ])
      assert.ok(matches[0].answer.includes(text));
    assert.equal(getCoreLearningEntry(entry.question, entry.category), entry);
    assert.equal(
      getCoreLearningEntry(entry.question, "invalid category"),
      undefined,
    );
  }
});
