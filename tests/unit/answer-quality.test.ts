import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveCharacters } from "../../src/db/answer-quality";
import { getSeedQuestions } from "../../src/db/seed-data";
import { validateQuestionBank } from "../../src/db/seed-bank";

test("headings, links, punctuation and code cannot inflate spoken text counts", () => {
  assert.equal(
    effectiveCharacters(
      "### 标题\n\n中文，A1！ [资料](https://example.com/long-path)\n```python\nprint('not spoken')\n```",
    ),
    6,
  );
});

test("seed rejects padded summaries and overlong oral answers before writing", () => {
  const rows = getSeedQuestions();
  const original = rows[0].answer;
  const replaceOral = (text: string) =>
    original.replace(/(### 30–60 秒回答\n\n)[\s\S]*?(?=\n\n### )/, `$1${text}`);
  rows[0] = {
    ...rows[0],
    answer: replaceOral(
      "一句摘要。\n\n### 装饰标题\n\nhttps://example.com/" + "a".repeat(500),
    ),
  };
  assert.ok(rows[0].answer.length > 320);
  assert.throws(() => validateQuestionBank(rows), /oral answer/);
  rows[0].answer = replaceOral("字".repeat(181));
  assert.throws(() => validateQuestionBank(rows), /oral answer/);
  rows[0].answer = original;
  validateQuestionBank(rows);
});

test("seed rejects missing teaching and examples even with a complete oral answer", () => {
  const rows = getSeedQuestions().map((entry) => ({ ...entry }));
  const row = rows.find((entry) => entry.tags.includes("简历专项"))!;
  row.answer = row.answer.replace(
    /(### 深入拆解与回答要点\n\n)[\s\S]*?(?=\n\n### )/,
    "$1准备回答。",
  );
  assert.throws(() => validateQuestionBank(rows), /substantive explanation/);
  const fresh = getSeedQuestions().map((entry) => ({ ...entry }));
  const resume = fresh.find((entry) => entry.tags.includes("简历专项"))!;
  resume.answer = resume.answer.replace(
    /(### 场景与验证准备\n\n)[\s\S]*?(?=\n\n### )/,
    "$1本人证据准备：准备一个例子。",
  );
  assert.throws(() => validateQuestionBank(fresh), /worked example/);
});
