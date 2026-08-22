import assert from "node:assert/strict";
import test from "node:test";

import { adaptRasterMap } from "../src/contracts/adapters/mapAdapter.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import {
  CANONICAL_MAP_FIXTURE,
  CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  CANONICAL_STALE_SNAPSHOT_FIXTURE,
  CANONICAL_PARTIAL_SNAPSHOT_FIXTURE,
} from "../src/contracts/fixtures/canonical.ts";

test("adaptRasterMap validates and adapts canonical map fixture", () => {
  const map = adaptRasterMap(CANONICAL_MAP_FIXTURE);
  assert.equal(map.contractVersion, "1.0.0");
  assert.equal(map.widthCells, 32);
  assert.equal(map.heightCells, 20);
  assert.equal(map.resolutionMeters, 1.0);
  assert.equal(map.coordinateFrame.xAxis, "EAST");
  assert.equal(map.coordinateFrame.yAxis, "NORTH");
  assert.equal(map.cells.length, 32 * 20);
});

test("adaptRasterMap rejects invalid cells count or version", () => {
  assert.throws(() => {
    adaptRasterMap({ ...CANONICAL_MAP_FIXTURE, contractVersion: "2.0.0" });
  }, /Incompatible map contract version/);

  assert.throws(() => {
    adaptRasterMap({ ...CANONICAL_MAP_FIXTURE, cells: [0, 1] });
  }, /array length/);
});

test("adaptOperationsSnapshot adapts canonical operations snapshot fixture", () => {
  const snapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  assert.equal(snapshot.contractVersion, "1.0.0");
  assert.equal(snapshot.freshness, "CURRENT");
  assert.equal(snapshot.cursor.eventSequence, 1420);
  assert.equal(snapshot.robots.length, 4);
  assert.equal(snapshot.orders.length, 2);

  const robot01 = snapshot.robots.find((r) => r.id === "robot-01");
  assert.ok(robot01);
  assert.equal(robot01.pose.xMeters, 4.5);
  assert.equal(robot01.pose.yMeters, 2.5);
  assert.equal(robot01.operationalState, "EXECUTING");
  assert.equal(robot01.connectivity, "CONNECTED");
  assert.equal(robot01.currentOrderId, "order-01");

  const robot04 = snapshot.robots.find((r) => r.id === "robot-04");
  assert.ok(robot04);
  assert.equal(robot04.pose.xMeters, 31.5);
  assert.equal(robot04.pose.yMeters, 4.5);
  assert.equal(robot04.operationalState, "CHARGING");
  assert.equal(robot04.batteryPercent, 42);

  const order01 = snapshot.orders.find((o) => o.id === "order-01");
  assert.ok(order01);
  assert.equal(order01.state, "Executing");
  assert.equal(order01.assignments[0].robotId, "robot-01");
  assert.equal(order01.assignments[0].goalColumn, 18);
  assert.equal(order01.assignments[0].goalRow, 19);
});

test("adaptOperationsSnapshot preserves stale and partial freshness states", () => {
  const stale = adaptOperationsSnapshot(CANONICAL_STALE_SNAPSHOT_FIXTURE);
  assert.equal(stale.freshness, "STALE");

  const partial = adaptOperationsSnapshot(CANONICAL_PARTIAL_SNAPSHOT_FIXTURE);
  assert.equal(partial.freshness, "PARTIAL");
});
