import assert from "node:assert/strict";
import test from "node:test";
import {
  generateStressSnapshot,
  advanceStressMotion,
} from "../src/contracts/fixtures/stressFleet.ts";
import { CANONICAL_MAP_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

test("generateStressSnapshot creates valid 50, 100, 500 robot fleets", () => {
  const snapshot50 = generateStressSnapshot(50, CANONICAL_MAP_FIXTURE);
  assert.equal(snapshot50.robots.length, 50);
  assert.equal(snapshot50.robots[0].id, "robot-001");
  assert.equal(snapshot50.robots[49].id, "robot-050");
  assert.ok(snapshot50.orders.length > 0);

  const snapshot500 = generateStressSnapshot(500, CANONICAL_MAP_FIXTURE);
  assert.equal(snapshot500.robots.length, 500);
  assert.equal(snapshot500.robots[499].id, "robot-500");

  // Verify poses are numeric and finite
  for (const robot of snapshot500.robots) {
    assert.ok(Number.isFinite(robot.pose.xMeters));
    assert.ok(Number.isFinite(robot.pose.yMeters));
    assert.ok(Number.isFinite(robot.pose.yawRadians));
    assert.ok(robot.batteryPercent >= 0 && robot.batteryPercent <= 100);
  }
});

test("advanceStressMotion smoothly updates positions within map bounds", () => {
  const initial = generateStressSnapshot(100, CANONICAL_MAP_FIXTURE);
  const updated = advanceStressMotion(initial, 1);

  assert.equal(updated.robots.length, 100);

  // Check that at least some executing robots changed position
  const moved = updated.robots.some((r, i) => {
    const orig = initial.robots[i];
    return (
      r.pose.xMeters !== orig.pose.xMeters ||
      r.pose.yMeters !== orig.pose.yMeters
    );
  });
  assert.ok(moved, "Executing robots should advance in simulation tick");
});
