import assert from "node:assert/strict";
import { test } from "node:test";
import { getSeedQuestions } from "../../src/db/seed-data";
import {
  getResumeLearningEntry,
  resumeQuestions,
} from "../../src/db/resume-questions";
import { resumeLearningAnswer } from "../../src/db/resume-content";

test("all 100 structured resume answers preserve the complete seed answer and serialize for the practice page", () => {
  assert.equal(resumeQuestions.length, 100);
  const kinds = new Set<string>();
  for (const question of resumeQuestions) {
    const entry = getResumeLearningEntry(question);
    assert.ok(entry, question.question);
    assert.equal(resumeLearningAnswer(entry), question.answer);
    assert.deepEqual(JSON.parse(JSON.stringify(entry)), entry);
    assert.equal(entry.points.length, 3);
    assert.equal(entry.followUps.length, 3);
    assert.ok(entry.basis.includes("指定简历第"));
    assert.ok(entry.evidence.includes("本人证据准备"));
    if (entry.kind === "扩展设计")
      assert.ok(entry.boundary.includes("如果扩展，我会……"));
    kinds.add(entry.kind);
  }
  assert.deepEqual(
    [...kinds].sort(),
    ["基础关联", "扩展设计", "简历实战"].sort(),
  );
});

test("database edits, invalid identities and unstructured questions retain the Markdown fallback", () => {
  const question = resumeQuestions[0];
  for (const changed of [
    { ...question, question: "未收录的简历追问" },
    { ...question, category: "RAG" },
    { ...question, subcategory: "普通题" },
    { ...question, tags: question.tags.filter((tag) => tag !== "简历专项") },
    { ...question, tags: [...question.tags, "发票实习"] },
    {
      ...question,
      tags: question.tags.map((tag) => (tag === "P0" ? "P1" : tag)),
    },
    { ...question, answer: question.answer + "\n\n数据库中保存的补充说明。" },
  ])
    assert.equal(getResumeLearningEntry(changed), undefined);
  for (const ordinary of getSeedQuestions().filter(
    (row) => !row.tags.includes("简历专项"),
  ))
    assert.equal(getResumeLearningEntry(ordinary), undefined);
});
