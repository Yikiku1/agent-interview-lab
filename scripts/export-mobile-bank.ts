import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { getSeedQuestions } from "../src/db/seed-data";
import { validateQuestionBank } from "../src/db/seed-bank";
import { corePath } from "../src/db/core-path";
import { getResumeLearningEntry } from "../src/db/resume-questions";
import { resumeMetadata } from "../src/lib/learning-contract";

// Stable content identities, independent of the personal PostgreSQL serial IDs.
// Never read credentials, practice history, or browser drafts into an APK.
const source = getSeedQuestions();
validateQuestionBank(source);
const rows = source.map((question) => ({
  ...question,
  id:
    parseInt(
      createHash("sha256").update(question.question).digest("hex").slice(0, 7),
      16,
    ) + 1,
  core: corePath.some((entry) => entry.question === question.question),
  coreOrder: corePath.findIndex(
    (entry) => entry.question === question.question,
  ),
  ...resumeMetadata(question),
  resume: getResumeLearningEntry(question) ?? null,
}));
if (new Set(rows.map((q) => q.id)).size !== rows.length)
  throw new Error("Mobile question identity collision");
async function main() {
  await mkdir("mobile/www", { recursive: true });
  await writeFile("mobile/www/questions.json", JSON.stringify(rows));
  console.log(
    `Exported ${rows.length} offline questions (${rows.filter((q) => q.resume).length} layered resume answers); no personal data.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
