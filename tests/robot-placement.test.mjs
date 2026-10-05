import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../src/services/api/client.ts";
import {
  placementCandidates,
  generateRobotPlacement,
} from "../src/domain/robot/placement.ts";
import {
  decodePendingCreation,
  submitRobotBatch,
} from "../src/domain/robot/creation.ts";

const map = {
  origin: { xMeters: -5, yMeters: 7 },
  resolutionMeters: 0.5,
  widthCells: 3,
  heightCells: 2,
  cells: [0, 0, 1, 0, 0, 0],
};
const nodes = Array.from({ length: 6 }, (_, id) => ({
  id,
  column: id % 3,
  row: Math.floor(id / 3),
  isTraversable: id !== 2,
}));
const command = (id) => ({
  contractVersion: "1.0.0",
  requestId: id,
  map: { mapId: "map", revision: 1, contentDigestSha256: "a".repeat(64) },
  start: { column: 0, row: 0 },
});
const outcome = (id, state) => ({
  contractVersion: "1.0.0",
  robotId: id,
  state,
});

test("filters obstacles and occupied cells with world coordinates, and orders by row then column", () => {
  const candidates = placementCandidates(map, [...nodes].reverse(), [
    { pose: { xMeters: -4.4, yMeters: 7.2 } },
  ]);
  assert.deepEqual(
    candidates.map((node) => node.id),
    [0, 3, 4, 5],
  );
  assert.deepEqual(generateRobotPlacement(3, candidates), [0, 3, 4]);
  assert.equal(new Set(generateRobotPlacement(4, candidates)).size, 4);
  assert.deepEqual(
    nodes.map((node) => node.id),
    [0, 1, 2, 3, 4, 5],
  );
});
test("rejects invalid counts and insufficient capacity without partial placement", () => {
  for (const count of [0, -1, 101, 1.5, NaN, Infinity])
    assert.throws(() => generateRobotPlacement(count, nodes), /COUNT/);
  assert.throws(() => generateRobotPlacement(7, nodes), /CAPACITY/);
  assert.deepEqual(generateRobotPlacement(1, nodes), [0]);
});
test("supports 100 distinct positions and respects raster obstacles", () => {
  assert.equal(
    generateRobotPlacement(
      100,
      Array.from({ length: 100 }, (_, id) => ({ id })),
    ).length,
    100,
  );
  assert.deepEqual(
    placementCandidates(map, [{ ...nodes[2], isTraversable: true }], []),
    [],
  );
});
test("recovers legacy single requests and batch progress, rejecting damaged data", () => {
  const legacy = {
    command: command("old"),
    outcome: outcome("r-001", "READY"),
  };
  assert.deepEqual(decodePendingCreation(JSON.stringify(legacy)), [legacy]);
  const batch = [legacy, { command: command("new"), uncertain: true }];
  assert.deepEqual(decodePendingCreation(JSON.stringify(batch)), batch);
  for (const value of [
    null,
    "{",
    "[]",
    JSON.stringify([legacy, legacy]),
    JSON.stringify({ command: {} }),
  ])
    assert.equal(decodePendingCreation(value), null);
});
test("batch continues after uncertain failure, skips ready robots and replays the same creation ID", async () => {
  let entries = [
    { command: command("a") },
    { command: command("b") },
    { command: command("done"), outcome: outcome("r-done", "READY") },
  ];
  const calls = [];
  const client = {
    async createRobot(request) {
      calls.push(request.requestId);
      if (calls.length === 1) throw new TypeError("lost response");
      return outcome(`r-${request.requestId}`, "PENDING");
    },
    async retryRobotProvisioning() {
      throw new Error("unexpected retry");
    },
  };
  const update = (entry) => {
    entries = entries.map((value) =>
      value.command.requestId === entry.command.requestId ? entry : value,
    );
  };
  await submitRobotBatch(entries, client, update);
  assert.deepEqual(calls, ["a", "b"]);
  assert.equal(entries[0].uncertain, true);
  await submitRobotBatch(entries, client, update);
  assert.deepEqual(calls, ["a", "b", "a"]);
  assert.equal(entries[0].outcome.state, "PENDING");
});
test("failed provisioning persists its retry key before sending and retains it across response loss", async () => {
  let entry = {
    command: command("create"),
    outcome: outcome("same-robot", "FAILED"),
  };
  const calls = [];
  const client = {
    async createRobot() {
      throw new Error("unexpected create");
    },
    async retryRobotProvisioning(id, request) {
      assert.equal(entry.retry.requestId, request.requestId);
      calls.push([id, request.requestId]);
      if (calls.length === 1) throw new TypeError("lost response");
      return outcome(id, "STARTING");
    },
  };
  await submitRobotBatch(
    [entry],
    client,
    (value) => {
      entry = value;
    },
    () => "retry-key",
  );
  entry = decodePendingCreation(JSON.stringify([entry]))[0];
  await submitRobotBatch(
    [entry],
    client,
    (value) => {
      entry = value;
    },
    () => "must-not-be-used",
  );
  assert.deepEqual(calls, [
    ["same-robot", "retry-key"],
    ["same-robot", "retry-key"],
  ]);
  assert.equal(entry.outcome.state, "STARTING");
  assert.equal(entry.retry, undefined);
});

test("known rejection remains inspectable while later entries are submitted", async () => {
  const results = new Map();
  const client = {
    async createRobot(request) {
      if (request.requestId === "occupied")
        throw new ProblemError({
          status: 409,
          code: "ROBOT_START_OCCUPIED",
          detail: "Start occupied",
        });
      return outcome("r-new", "PENDING");
    },
    async retryRobotProvisioning() {
      throw new Error("unexpected retry");
    },
  };
  await submitRobotBatch(
    [{ command: command("occupied") }, { command: command("free") }],
    client,
    (entry) => results.set(entry.command.requestId, entry),
  );
  assert.equal(results.get("occupied").rejected, true);
  assert.equal(results.get("occupied").uncertain, false);
  assert.equal(results.get("occupied").error, "Start occupied");
  assert.equal(results.get("free").outcome.state, "PENDING");
});
