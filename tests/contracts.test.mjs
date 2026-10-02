import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("generated contract preserves action and message identities", async () => {
  const source = await readFile(
    path.resolve(repositoryRoot, "src/contracts/generated.ts"),
    "utf8",
  );
  assert.match(source, /\["WAIT", "NORTH", "EAST", "SOUTH", "WEST"\]/);
  assert.match(source, /"report\.ack"/);
  assert.match(source, /"robot\.state\.report"/);
});
