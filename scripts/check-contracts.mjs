import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const coreLockPath = path.resolve(
  repositoryRoot,
  "../mapf-rl-core/packages/contracts/contracts.lock.json",
);
const consumerLockPath = path.resolve(
  repositoryRoot,
  "src/contracts/contracts.lock.json",
);
const generatedPath = path.resolve(
  repositoryRoot,
  "src/contracts/generated.ts",
);
const coreContractsRoot = path.dirname(coreLockPath);

const [coreLockText, consumerLockText, generated] = await Promise.all([
  readFile(coreLockPath, "utf8"),
  readFile(consumerLockPath, "utf8"),
  readFile(generatedPath, "utf8"),
]);

const coreLock = JSON.parse(coreLockText);
const consumerLock = JSON.parse(consumerLockText);
const { sourceRevision, ...consumerContract } = consumerLock;
assert.equal(
  typeof sourceRevision,
  "string",
  "FE lock source revision is missing",
);
assert.deepEqual(
  consumerContract,
  coreLock,
  "FE contract lock differs from Core",
);
assert.match(
  generated,
  new RegExp(`CONTRACT_TREE_SHA256 = "${coreLock.treeDigestSha256}"`),
  "generated TypeScript carries a stale contract digest",
);

for (const [relativePath, expectedDigest] of Object.entries(coreLock.files)) {
  if (
    !relativePath.startsWith("fixtures/") ||
    !relativePath.endsWith(".json")
  ) {
    continue;
  }
  const content = await readFile(path.resolve(coreContractsRoot, relativePath));
  const actualDigest = createHash("sha256").update(content).digest("hex");
  assert.equal(
    actualDigest,
    expectedDigest,
    `fixture digest mismatch: ${relativePath}`,
  );
  JSON.parse(content.toString("utf8"));
}
