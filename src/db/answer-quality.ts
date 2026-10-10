export type AnswerSection = { heading: string; text: string };

export function answerSections(answer: string): AnswerSection[] {
  return answer
    .split(/^### /m)
    .slice(1)
    .map((raw) => {
      const split = raw.indexOf("\n");
      return {
        heading: raw.slice(0, split).trim(),
        text: raw.slice(split + 1).trim(),
      };
    });
}

export function plainAnswerText(text: string): string {
  return text
    .replace(/```[^\n]*\n[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^#+ .*$/gm, "")
    .replace(/[`*_>|#~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Letters and numbers are a reproducible drafting measure, not spoken syllables.
export function effectiveCharacters(text: string): number {
  return [...plainAnswerText(text).matchAll(/[\p{L}\p{N}]/gu)].length;
}

export function oralDraftRange(resume: boolean) {
  return resume
    ? { minimum: 240, maximum: 270 }
    : { minimum: 120, maximum: 180 };
}

export function answerLayers(answer: string) {
  const parts = answerSections(answer);
  return {
    parts,
    oral: parts.find((part) =>
      ["30–60 秒回答", "60–90 秒回答思路"].includes(part.heading),
    ),
    explanation: parts.filter((part) =>
      /^(深入理解|原理与实现|逐题讲解与场景|深入拆解与回答要点)$/.test(
        part.heading,
      ),
    ),
    examples: parts.filter((part) =>
      /^(最小示例与验证|落地示例与验证|场景与验证准备)$/.test(part.heading),
    ),
  };
}

export function validateAnswerContent(
  question: string,
  answer: string,
  resume: boolean,
) {
  const layers = answerLayers(answer);
  const range = oralDraftRange(resume);
  const oralCount = effectiveCharacters(layers.oral?.text ?? "");
  if (oralCount < range.minimum || oralCount > range.maximum)
    throw new Error(
      `${question}: oral answer needs ${range.minimum}–${range.maximum} effective characters, got ${oralCount}`,
    );
  if (
    layers.explanation.reduce(
      (sum, part) => sum + effectiveCharacters(part.text),
      0,
    ) < 35
  )
    throw new Error(`${question}: missing substantive explanation`);
  if (
    !layers.examples.some((part) => {
      const scenario = part.text.split("本人证据准备")[0];
      return (
        effectiveCharacters(scenario) >= 25 ||
        /```[^\n]*\n[\s\S]+?```/.test(scenario)
      );
    })
  )
    throw new Error(`${question}: missing a worked example`);
}
