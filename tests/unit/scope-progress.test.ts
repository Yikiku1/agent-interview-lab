import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseScopeProgressQuery,
  scopeProgressLabel,
} from "../../src/lib/scope-progress-contract";
test("default progress follows saved target while explicit empty custom scope stays all questions", () => {
  assert.deepEqual(parseScopeProgressQuery({}), {
    filters: undefined,
    page: 1,
  });
  assert.deepEqual(parseScopeProgressQuery({ page: "2" }), {
    filters: undefined,
    page: 2,
  });
  assert.ok(parseScopeProgressQuery({ scope: "custom" }).filters);
  assert.equal(
    parseScopeProgressQuery({ project: "VendorGuard" }).filters?.track,
    "resume",
  );
  assert.match(
    scopeProgressLabel(
      parseScopeProgressQuery({
        project: "VendorGuard",
        resumePriority: "P0",
        status: "mastered",
      }).filters!,
    ),
    /VendorGuard · P0 · 自评：已掌握/,
  );
});
test("progress refuses invalid, duplicate, unknown or conflicting filters instead of broadening the denominator", () => {
  for (const query of [
    { scope: "target" },
    { preset: ["resume_focus", "general_core"] },
    { category: "invalid" },
    { difficulty: "invalid" },
    { userId: "other" },
    { preset: "general_core", project: "VendorGuard" },
    { page: "1e2" },
    { page: "0" },
    { page: "2147483648" },
  ])
    assert.throws(() => parseScopeProgressQuery(query));
});
