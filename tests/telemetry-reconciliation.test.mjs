import assert from "node:assert/strict";
import test from "node:test";
import {
  reconciliationReducer as reduce,
  selectReconciliationView as view,
  INITIAL_RECONCILIATION_STATE,
} from "../src/state/reconciliation/reducer.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";
import {
  NOMINAL_ROBOT_EVENT_1421,
  GAP_STREAM_EVENT_1425,
  CONFLICT_STREAM_EVENT_1420,
} from "../src/contracts/fixtures/reconciliationFixtures.ts";

const boot = "123e4567-e89b-42d3-a456-426614174000";
const robot = (state) => state.snapshot.robots.find((r) => r.id === "robot-01");
function loaded() {
  return reduce(INITIAL_RECONCILIATION_STATE, {
    type: "SNAPSHOT_REPLACED",
    snapshot: adaptOperationsSnapshot(CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE),
  });
}
function telemetry(state, version = 100) {
  return reduce(state, {
    type: "TELEMETRY_RECEIVED",
    robotId: "robot-01",
    data: {
      ...NOMINAL_ROBOT_EVENT_1421.payload.data,
      stateVersion: version,
      simulatorBootId: boot,
      pose: { xMeters: 10, yMeters: 2.5, yawRadians: 0 },
    },
  });
}

for (const legacy of [false, true]) {
  test(`delayed durable event preserves telemetry pose and epoch (legacy=${legacy})`, () => {
    const current = telemetry(loaded());
    const event = structuredClone(NOMINAL_ROBOT_EVENT_1421);
    event.payload.data.simulatorBootId = boot;
    if (legacy) delete event.payload.data.sessionEpoch;
    const next = reduce(current, { type: "STREAM_EVENT_RECEIVED", event });
    assert.deepEqual(robot(next), robot(current));
    assert.equal(next.cursor.eventSequence, event.eventSequence);
  });
}

test("durable report with a different boot in the same epoch cannot replace telemetry", () => {
  const current = telemetry(loaded());
  const event = structuredClone(NOMINAL_ROBOT_EVENT_1421);
  event.payload.entityVersion = event.payload.data.stateVersion = 101;
  event.payload.data.simulatorBootId = "123e4567-e89b-42d3-a456-426614174001";
  const next = reduce(current, { type: "STREAM_EVENT_RECEIVED", event });
  assert.deepEqual(robot(next), robot(current));
});

test("newer durable report still updates a matching telemetry session", () => {
  const current = telemetry(loaded());
  const event = structuredClone(NOMINAL_ROBOT_EVENT_1421);
  event.payload.entityVersion = event.payload.data.stateVersion = 101;
  event.payload.data.simulatorBootId = boot;
  const next = reduce(current, { type: "STREAM_EVENT_RECEIVED", event });
  assert.equal(robot(next).stateVersion, 101);
  assert.equal(robot(next).pose.xMeters, event.payload.data.pose.xMeters);
  assert.equal(robot(next).sessionEpoch, robot(current).sessionEpoch);
});

for (const event of [GAP_STREAM_EVENT_1425, CONFLICT_STREAM_EVENT_1420]) {
  test(`telemetry cannot clear durable ${event === GAP_STREAM_EVENT_1425 ? "GAP" : "CONFLICT"}`, () => {
    let state = reduce(loaded(), { type: "STREAM_EVENT_RECEIVED", event });
    const cursor = state.cursor;
    state = reduce(state, { type: "TELEMETRY_STALE" });
    assert.equal(view(state).connectionState, "Reconciling");
    state = telemetry(state);
    assert.equal(robot(state).stateVersion, 100);
    assert.deepEqual(state.cursor, cursor);
    assert.equal(view(state).connectionState, "Reconciling");
    assert.equal(view(state).snapshot.freshness, "RECONCILING");
    state = reduce(state, {
      type: "SNAPSHOT_REPLACED",
      snapshot: adaptOperationsSnapshot(CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE),
    });
    assert.equal(view(state).connectionState, "Current");
  });
}

test("telemetry outage only overlays freshness and cannot be cleared by durable events", () => {
  let state = reduce(loaded(), { type: "TELEMETRY_STALE" });
  assert.equal(state.connectionState, "Current");
  assert.equal(view(state).connectionState, "Stale");
  assert.equal(robot(view(state)).freshness, "STALE");
  state = reduce(state, {
    type: "STREAM_EVENT_RECEIVED",
    event: NOMINAL_ROBOT_EVENT_1421,
  });
  assert.equal(view(state).connectionState, "Stale");
  state = telemetry(state);
  assert.equal(view(state).connectionState, "Current");
  assert.equal(robot(view(state)).freshness, "CURRENT");
});

for (const connectionState of ["Disconnected", "Partial", "Failed"]) {
  test(`telemetry preserves durable ${connectionState} state`, () => {
    const state = reduce(loaded(), {
      type: "CONNECTION_STATE_CHANGED",
      connectionState,
    });
    assert.equal(view(telemetry(state)).connectionState, connectionState);
  });
}
