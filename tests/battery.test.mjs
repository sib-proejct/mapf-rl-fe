import assert from "node:assert/strict";
import test from "node:test";
import {
  isLowBattery,
  batteryLabel,
  adaptBatteryPolicy,
} from "../src/utils/battery.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

const policy = {
  version: "1.0.0",
  lowBatteryPercent: 20,
  depletedPercent: 0,
  chargeTargetPercent: 100,
};
const robot = { id: "r1", batteryPercent: 20, operationalState: "IDLE" };
test("Core policy gates new work at the boundary and preserves legacy snapshots", () => {
  assert.equal(isLowBattery(robot, policy), true);
  assert.equal(
    isLowBattery({ ...robot, batteryPercent: 20.01 }, policy),
    false,
  );
  assert.equal(isLowBattery(robot), false);
  assert.equal(
    adaptOperationsSnapshot(CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE)
      .batteryPolicy,
    undefined,
  );
  assert.deepEqual(
    adaptOperationsSnapshot({
      ...CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
      batteryPolicy: policy,
    }).batteryPolicy,
    policy,
  );
  assert.throws(() =>
    adaptBatteryPolicy({ ...policy, lowBatteryPercent: NaN }),
  );
  assert.throws(() => adaptBatteryPolicy({ ...policy, version: "2.0.0" }));
});
test("battery labels distinguish work, charger travel, charging and depletion", () => {
  assert.equal(batteryLabel(robot, [], policy), "충전 대기");
  assert.equal(
    batteryLabel({ ...robot, operationalState: "EXECUTING" }, [], policy),
    "배터리 부족 · 작업 후 충전",
  );
  const orders = [
    {
      state: "Planning",
      assignments: [{ robotId: "r1", arrivalAction: "CHARGE" }],
    },
  ];
  assert.equal(batteryLabel(robot, orders, policy), "충전소 이동");
  assert.equal(
    batteryLabel({ ...robot, operationalState: "CHARGING" }, orders, policy),
    "충전 중",
  );
  assert.equal(
    batteryLabel({ ...robot, batteryPercent: 0 }, orders, policy),
    "배터리 고갈",
  );
});
