import assert from "node:assert/strict";
import test from "node:test";

import {
  reconciliationReducer,
  INITIAL_RECONCILIATION_STATE,
  coalesceStreamBatch,
} from "../src/state/reconciliation/reducer.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";
import {
  NOMINAL_ROBOT_EVENT_1421,
  NOMINAL_ROBOT_EVENT_1422,
  DUPLICATE_STREAM_EVENT_1420,
  STALE_STREAM_EVENT_1400,
  GAP_STREAM_EVENT_1425,
  CONFLICT_STREAM_EVENT_1420,
  ORDER_LIFECYCLE_EVENT_1421,
} from "../src/contracts/fixtures/reconciliationFixtures.ts";

test("reconciliationReducer: SNAPSHOT_REPLACED atomically loads snapshot and replays buffered events", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  assert.equal(baseSnapshot.cursor.eventSequence, 1420);

  // Replaces snapshot with buffered events [1421, 1422]
  const stateAfterReplace = reconciliationReducer(
    INITIAL_RECONCILIATION_STATE,
    {
      type: "SNAPSHOT_REPLACED",
      snapshot: baseSnapshot,
      bufferedEvents: [NOMINAL_ROBOT_EVENT_1421, NOMINAL_ROBOT_EVENT_1422],
    },
  );

  assert.ok(stateAfterReplace.snapshot);
  assert.equal(stateAfterReplace.cursor.eventSequence, 1422);
  assert.equal(stateAfterReplace.connectionState, "Current");
  assert.equal(stateAfterReplace.snapshot.freshness, "CURRENT");

  // Verify robot-01 pose advanced to 1422 value (4.7, 2.5)
  const robot01 = stateAfterReplace.snapshot.robots.find(
    (r) => r.id === "robot-01",
  );
  assert.ok(robot01);
  assert.equal(robot01.pose.xMeters, 4.7);
  assert.equal(robot01.stateVersion, 44);
});

test("reconciliationReducer: DUPLICATE event produces zero state change and increments duplicateCount", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  const stateWithSnapshot = reconciliationReducer(
    INITIAL_RECONCILIATION_STATE,
    {
      type: "SNAPSHOT_REPLACED",
      snapshot: baseSnapshot,
    },
  );

  const initialRobotsRef = stateWithSnapshot.snapshot.robots;

  // Receive duplicate of sequence 1420
  const stateAfterDup = reconciliationReducer(stateWithSnapshot, {
    type: "STREAM_EVENT_RECEIVED",
    event: DUPLICATE_STREAM_EVENT_1420,
  });

  // Verification 1: duplicateCount incremented
  assert.equal(stateAfterDup.diagnostics.duplicateCount, 1);
  assert.equal(stateAfterDup.diagnostics.lastDecision, "DUPLICATE");

  // Verification 2: Robots array reference and values are unchanged
  assert.equal(stateAfterDup.snapshot.robots, initialRobotsRef);
  assert.equal(stateAfterDup.cursor.eventSequence, 1420);
});

test("reconciliationReducer: GAP event never arbitrarily stitches state and transitions to Reconciling", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  const stateWithSnapshot = reconciliationReducer(
    INITIAL_RECONCILIATION_STATE,
    {
      type: "SNAPSHOT_REPLACED",
      snapshot: baseSnapshot,
    },
  );

  assert.equal(stateWithSnapshot.cursor.eventSequence, 1420);

  // Receive gap sequence 1425 (expected was 1421)
  const stateAfterGap = reconciliationReducer(stateWithSnapshot, {
    type: "STREAM_EVENT_RECEIVED",
    event: GAP_STREAM_EVENT_1425,
  });

  // Verification: Sequence remains 1420 (not advanced to 1425), marked RECONCILING
  assert.equal(stateAfterGap.cursor.eventSequence, 1420);
  assert.equal(stateAfterGap.snapshot.freshness, "RECONCILING");
  assert.equal(stateAfterGap.connectionState, "Reconciling");
  assert.equal(stateAfterGap.diagnostics.gapCount, 1);
  assert.equal(stateAfterGap.diagnostics.lastDecision, "GAP");
  assert.deepEqual(stateAfterGap.diagnostics.lastGapDetails, {
    expected: 1421,
    received: 1425,
  });
});

test("reconciliationReducer: STALE event is ignored without regressing current state", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  const stateWithSnapshot = reconciliationReducer(
    INITIAL_RECONCILIATION_STATE,
    {
      type: "SNAPSHOT_REPLACED",
      snapshot: baseSnapshot,
    },
  );

  const robot01Before = stateWithSnapshot.snapshot.robots.find(
    (r) => r.id === "robot-01",
  );
  assert.equal(robot01Before.stateVersion, 42);

  // Receive stale event with stateVersion 10 and sequence 1400
  const stateAfterStale = reconciliationReducer(stateWithSnapshot, {
    type: "STREAM_EVENT_RECEIVED",
    event: STALE_STREAM_EVENT_1400,
  });

  assert.equal(stateAfterStale.diagnostics.staleCount, 1);
  assert.equal(stateAfterStale.diagnostics.lastDecision, "STALE");

  const robot01After = stateAfterStale.snapshot.robots.find(
    (r) => r.id === "robot-01",
  );
  assert.equal(robot01After.stateVersion, 42); // Not regressed to 10
  assert.equal(robot01After.pose.xMeters, 4.5);
});

test("reconciliationReducer: CONFLICT event detects contradictory data for same version", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  const stateWithSnapshot = reconciliationReducer(
    INITIAL_RECONCILIATION_STATE,
    {
      type: "SNAPSHOT_REPLACED",
      snapshot: baseSnapshot,
    },
  );

  // Receive conflicting payload for robot-01 at stateVersion 42
  const stateAfterConflict = reconciliationReducer(stateWithSnapshot, {
    type: "STREAM_EVENT_RECEIVED",
    event: CONFLICT_STREAM_EVENT_1420,
  });

  assert.equal(stateAfterConflict.diagnostics.conflictCount, 1);
  assert.equal(stateAfterConflict.diagnostics.lastDecision, "CONFLICT");
  assert.equal(stateAfterConflict.snapshot.freshness, "RECONCILING");
  assert.equal(stateAfterConflict.connectionState, "Reconciling");
  assert.ok(stateAfterConflict.diagnostics.lastConflictReason);
});

test("reconciliationReducer: applies order lifecycle transition event", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  const stateWithSnapshot = reconciliationReducer(
    INITIAL_RECONCILIATION_STATE,
    {
      type: "SNAPSHOT_REPLACED",
      snapshot: baseSnapshot,
    },
  );

  const stateAfterOrderEvent = reconciliationReducer(stateWithSnapshot, {
    type: "STREAM_EVENT_RECEIVED",
    event: ORDER_LIFECYCLE_EVENT_1421,
  });

  assert.equal(stateAfterOrderEvent.cursor.eventSequence, 1421);
  const order01 = stateAfterOrderEvent.snapshot.orders.find(
    (o) => o.id === "order-01",
  );
  assert.ok(order01);
  assert.equal(order01.state, "Completed");
  assert.equal(order01.orderUpdateId, 1);
});

test("coalesceStreamBatch: collapses multiple state reports for the same robot", () => {
  const batch = [
    NOMINAL_ROBOT_EVENT_1421, // robot-01 version 43
    NOMINAL_ROBOT_EVENT_1422, // robot-01 version 44 (latest)
    ORDER_LIFECYCLE_EVENT_1421, // non-replaceable order event
  ];

  const { coalescedEvents, coalescedCount } = coalesceStreamBatch(batch);

  assert.equal(coalescedCount, 1);
  assert.equal(coalescedEvents.length, 2);
  // Preserves 1422 (latest robot report) and order event
  assert.ok(coalescedEvents.some((e) => e.eventSequence === 1422));
  assert.ok(coalescedEvents.some((e) => e.messageType === "operations.event"));
});

test("MockStreamEngine nominal 10Hz stream produces zero gaps, zero conflicts, and steady CURRENT status", async () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );

  let state = reconciliationReducer(INITIAL_RECONCILIATION_STATE, {
    type: "SNAPSHOT_REPLACED",
    snapshot: baseSnapshot,
  });

  const { MockStreamEngine: Engine } = await import(
    "../src/services/websocket/mockStream.ts"
  );
  const engine = new Engine();
  engine.start(state.cursor.eventSequence, "nominal_10hz", state.snapshot);

  for (let tick = 0; tick < 20; tick++) {
    const events = engine.generateEvents(state.snapshot, null);
    assert.ok(events.length > 0);

    state = reconciliationReducer(state, {
      type: "STREAM_BATCH_RECEIVED",
      events,
    });

    assert.equal(state.connectionState, "Current");
    assert.equal(state.snapshot.freshness, "CURRENT");
    assert.equal(state.diagnostics.gapCount, 0);
    assert.equal(state.diagnostics.conflictCount, 0);
  }

  assert.equal(
    state.cursor.eventSequence,
    1420 + 20 * baseSnapshot.robots.length,
  );
  engine.stop();
});
