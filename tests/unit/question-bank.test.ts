import assert from "node:assert/strict";
import { test } from "node:test";
import { getSeedQuestions, retiredQuestionTexts } from "../../src/db/seed-data";
import { basicQuestions } from "../../src/db/basic-questions";
import { coreAnswers } from "../../src/db/core-answers";
import { validateQuestionBank } from "../../src/db/seed-bank";

test("570 questions include 70 distinct basics and 30 refined existing questions", () => {
  const rows = getSeedQuestions();
  validateQuestionBank(rows);
  assert.equal(rows.length, 570);
  assert.equal(new Set(rows.map((row) => row.question)).size, 570);
  assert.equal(basicQuestions.length, 70);
  assert.equal(Object.keys(coreAnswers).length, 30);
  assert.equal(rows.filter((row) => row.difficulty === "easy").length, 84);
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
