import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readNoteDraft,
  writeNoteDraft,
  subscribeNotes,
} from "../../src/lib/note-draft";
import {
  gapQueue,
  parseGapQuery,
  positiveId,
} from "../../src/lib/practice-notes-contract";
test("gap queue keeps oldest input order, dedupes and skips resolved or inactive questions", () => {
  const row = (id: number, active = true, resolvedAt: unknown = null) => ({
    question: { id, active },
    gap: { resolvedAt },
  });
  assert.deepEqual(
    gapQueue(
      [
        row(4),
        row(2),
        row(4),
        row(9, false),
        row(8, true, "time"),
        row(3),
        row(6),
      ],
      3,
    ),
    [4, 2, 3],
  );
});
test("gap scope and state parsing are strict and reuse resume scope normalization", () => {
  assert.deepEqual(
    parseGapQuery({ project: "VendorGuard", kind: "evidence", resolved: "all" })
      .filters.track,
    "resume",
  );
  assert.equal(parseGapQuery({}).resolved, false);
  for (const value of [
    { kind: ["concept", "other"] },
    { userId: "other" },
    { project: "invalid" },
  ])
    assert.throws(() => parseGapQuery(value));
  for (const id of ["1e0", "-1", "0", "2147483648"])
    assert.equal(positiveId.safeParse(id).success, false);
});

test("quota failure retains latest edits even when localStorage still reads an older draft", () => {
  const previousStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => '{"answer":"old"}',
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  });
  try {
    let changes = 0;
    const unsubscribe = subscribeNotes(() => changes++);
    assert.equal(
      writeNoteDraft("practice:note:test-quota", { answer: "latest" }),
      false,
    );
    assert.equal(
      readNoteDraft("practice:note:test-quota"),
      '{"answer":"latest"}',
    );
    assert.equal(writeNoteDraft("practice:note:test-quota", null), false);
    assert.equal(readNoteDraft("practice:note:test-quota"), null);
    assert.equal(changes, 2);
    unsubscribe();
  } finally {
    if (previousStorage)
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
