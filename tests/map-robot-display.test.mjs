import assert from "node:assert/strict";
import test from "node:test";
import {
  findRobotOrder,
  selectionColor,
} from "../src/components/map/mapRobotDisplay.ts";
import { updateRobotTrails } from "../src/components/map/robotTrails.ts";
const robot = {
  id: "r-1",
  currentOrderId: "o-1",
  freshness: "CURRENT",
  pose: { xMeters: 1, yMeters: 1 },
  simulationTimeMs: 1,
  sessionEpoch: 1,
};
const order = {
  id: "o-1",
  state: "Executing",
  mapId: "map",
  mapRevision: 1,
  assignments: [{ robotId: "r-1", goalColumn: 4, goalRow: 5 }],
};
const update = (trails, robots, orders) =>
  updateRobotTrails(trails, robots, orders, "map", 1);
test("terminal orders clear trails even with stale and delayed telemetry", () => {
  for (const state of ["Completed", "Cancelled", "Rejected"]) {
    const trails = new Map();
    update(trails, [robot], [order]);
    update(trails, [{ ...robot, freshness: "STALE" }], [{ ...order, state }]);
    assert.equal(trails.size, 0);
    update(trails, [robot], [{ ...order, state }]);
    assert.equal(trails.size, 0);
  }
});
test("wait and replan retain trails, next order resets and removal clears", () => {
  const trails = new Map();
  update(trails, [robot], [order]);
  for (const state of ["Held", "Replanning", "Executing"]) {
    update(
      trails,
      [{ ...robot, operationalState: "STOPPED", safety: "WAIT" }],
      [{ ...order, state }],
    );
    assert.equal(trails.get(robot.id).points.length, 1);
  }
  for (let i = 0; i < 250; i++)
    update(
      trails,
      [{ ...robot, pose: { xMeters: i, yMeters: 1 }, simulationTimeMs: i }],
      [order],
    );
  assert.equal(trails.get(robot.id).points.length, 200);
  update(
    trails,
    [{ ...robot, currentOrderId: "o-2", simulationTimeMs: 251 }],
    [{ ...order, id: "o-2" }],
  );
  assert.equal(trails.get(robot.id).points.length, 1);
  update(trails, [{ ...robot, sessionEpoch: 2 }], [order]);
  assert.equal(trails.get(robot.id).sessionEpoch, 2);
  update(trails, [], [order]);
  assert.equal(trails.size, 0);
});
test("goals prefer current order and exclude terminal and other maps", () => {
  const other = { ...order, id: "o-2" };
  assert.equal(findRobotOrder(robot, [other, order], "map", 1), order);
  assert.equal(
    findRobotOrder(robot, [other, { ...order, state: "Completed" }], "map", 1),
    undefined,
  );
  assert.equal(
    findRobotOrder(robot, [{ ...order, mapRevision: 2 }], "map", 1),
    undefined,
  );
  assert.equal(
    findRobotOrder({ ...robot, currentOrderId: undefined }, [other], "map", 1),
    other,
  );
  assert.equal(selectionColor(false), "#172554");
  assert.equal(selectionColor(true), "#A5B4FC");
});
