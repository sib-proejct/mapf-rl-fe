import assert from "node:assert/strict";
import test from "node:test";
import { adaptTrafficWait } from "../src/contracts/adapters/trafficAdapter.ts";
import { adaptRobotStateReport } from "../src/contracts/adapters/eventAdapter.ts";
import { NOMINAL_ROBOT_EVENT_1421 } from "../src/contracts/fixtures/reconciliationFixtures.ts";
const wait = {
  contractVersion: "1.0.0",
  reason: "PASSAGE_RIGHT_UNAVAILABLE",
  blockingRobotIds: ["r-005"],
};
test("passage wait preserves executing state, blocker and safe resume", () => {
  const base = { ...NOMINAL_ROBOT_EVENT_1421.payload.data, robotId: "r-001" };
  const blocked = adaptRobotStateReport({
    ...base,
    operationalState: "EXECUTING",
    safety: "WAIT",
    trafficWait: wait,
  });
  assert.equal(blocked.operationalState, "EXECUTING");
  assert.equal(blocked.safety, "WAIT");
  assert.deepEqual(blocked.trafficWait, wait);
  assert.equal(
    adaptRobotStateReport({ ...base, trafficWait: undefined }).trafficWait,
    undefined,
  );
});
test("unsupported passage wait is never accepted as version one", () => {
  assert.equal(
    adaptTrafficWait({ ...wait, contractVersion: "2.0.0" }),
    undefined,
  );
  assert.equal(adaptTrafficWait({ ...wait, blockingRobotIds: [2] }), undefined);
});
