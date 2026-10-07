import assert from "node:assert/strict";
import test from "node:test";
import { pageFromPath, pagePaths } from "../src/app/navigation.ts";

test("every screen resolves from its own URL, including trailing slashes", () => {
  for (const [page, path] of Object.entries(pagePaths)) {
    assert.equal(pageFromPath(path), page);
    assert.equal(pageFromPath(`${path}/`), page);
  }
  assert.equal(new Set(Object.values(pagePaths)).size, 6);
});

test("the root and unknown paths retain the operations landing screen", () => {
  assert.equal(pageFromPath("/"), "operations");
  assert.equal(pageFromPath("/unknown"), "operations");
  assert.equal(pageFromPath("/orders/unknown"), "operations");
});
