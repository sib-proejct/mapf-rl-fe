import assert from "node:assert/strict";
import test from "node:test";

import {
  coalesceStreamBatch,
  reconciliationReducer,
  INITIAL_RECONCILIATION_STATE,
} from "../src/state/reconciliation/reducer.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

test("stream performance: coalesces 10,000 high-frequency robot telemetry events into bounded O(N) updates", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );
  let state = reconciliationReducer(INITIAL_RECONCILIATION_STATE, {
    type: "SNAPSHOT_REPLACED",
    snapshot: baseSnapshot,
  });

  const ROBOT_COUNT = 50;
  const TICKS = 200;
  const batchEvents = [];

  let seq = 1420;
  for (let t = 0; t < TICKS; t++) {
    for (let r = 0; r < ROBOT_COUNT; r++) {
      seq++;
      batchEvents.push({
        contractVersion: "1.0.0",
        messageId: `msg-perf-${seq}`,
        messageType: "operations.event",
        producer: { kind: "CORE", id: "core-api" },
        occurredAt: new Date().toISOString(),
        correlationId: `corr-${seq}`,
        eventSequence: seq,
        payload: {
          entityType: "ROBOT",
          entityId: `robot-${String(r + 1).padStart(2, "0")}`,
          entityVersion: 100 + t,
          contentDigestSha256: seq.toString(16).padStart(64, "0"),
          data: {
            stateVersion: 100 + t,
            simulationTimeMs: 12400 + t * 50,
            pose: {
              xMeters: 4.5 + t * 0.01,
              yMeters: 2.5 + t * 0.01,
              yawRadians: 0,
            },
            operationalState: "EXECUTING",
            connectivity: "CONNECTED",
            safety: "NORMAL",
            activeController: {
              mode: "BASELINE",
              identity: "cardinal-baseline/1.0.0",
            },
            batteryPercent: 90,
          },
        },
      });
    }
  }

  assert.equal(batchEvents.length, 10000);

  const startTime = performance.now();
  const { coalescedEvents, coalescedCount } = coalesceStreamBatch(batchEvents);
  const elapsedCoalesce = performance.now() - startTime;

  // Coalescing collapses 10,000 events down to exactly 50 latest robot reports
  assert.equal(coalescedEvents.length, ROBOT_COUNT);
  assert.equal(coalescedCount, 10000 - ROBOT_COUNT);
  assert.ok(
    elapsedCoalesce < 50,
    `Coalescing took ${elapsedCoalesce.toFixed(2)}ms (must be < 50ms)`,
  );

  // Apply the coalesced batch to state
  const stateAfterBatch = reconciliationReducer(state, {
    type: "STREAM_BATCH_RECEIVED",
    events: batchEvents,
  });

  assert.equal(stateAfterBatch.diagnostics.coalescedCount, 10000 - ROBOT_COUNT);
  assert.equal(stateAfterBatch.diagnostics.totalEventsProcessed, 10000);
});
