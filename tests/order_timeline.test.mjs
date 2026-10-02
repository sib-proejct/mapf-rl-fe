import assert from "node:assert/strict";
import test from "node:test";

import {
  reconciliationReducer,
  INITIAL_RECONCILIATION_STATE,
} from "../src/state/reconciliation/reducer.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

test("Order Timeline: records Application Ack (Applied) vs Execution State (Executing) distinctly", () => {
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );

  let state = reconciliationReducer(INITIAL_RECONCILIATION_STATE, {
    type: "SNAPSHOT_REPLACED",
    snapshot: baseSnapshot,
  });

  const orderId = "order-01";
  const initialOrder = state.snapshot?.orders.find((o) => o.id === orderId);
  assert.ok(initialOrder);

  // Transition 1: Core dispatches and simulator acknowledges (Applied)
  state = reconciliationReducer(state, {
    type: "STREAM_BATCH_RECEIVED",
    events: [
      {
        contractVersion: "1.0.0",
        messageId: "00000000-0000-4000-8000-000000001421",
        messageType: "operations.event",
        producer: { kind: "SIMULATOR", id: "sim-01" },
        occurredAt: "2026-08-23T10:05:00Z",
        correlationId: "corr-order-1421",
        eventSequence: 1421,
        payload: {
          entityType: "ORDER",
          entityId: orderId,
          entityVersion: 2,
          contentDigestSha256: "a".repeat(64),
          data: {
            state: "Applied",
            orderUpdateId: 1,
            planRevisionId: "plan-rev-101",
          },
        },
      },
    ],
  });

  let updatedOrder = state.snapshot?.orders.find((o) => o.id === orderId);
  assert.ok(updatedOrder);
  assert.equal(updatedOrder.state, "Applied");
  assert.equal(updatedOrder.orderUpdateId, 1);

  const appliedEntry = updatedOrder.timeline?.find(
    (t) => t.state === "Applied",
  );
  assert.ok(appliedEntry);
  assert.equal(
    appliedEntry.isApplicationAck,
    true,
    "Applied state must have isApplicationAck=true",
  );
  assert.equal(appliedEntry.actor, "Simulator");

  // Transition 2: Robot physics starts moving (Executing)
  state = reconciliationReducer(state, {
    type: "STREAM_BATCH_RECEIVED",
    events: [
      {
        contractVersion: "1.0.0",
        messageId: "00000000-0000-4000-8000-000000001422",
        messageType: "operations.event",
        producer: { kind: "SIMULATOR", id: "sim-01" },
        occurredAt: "2026-08-23T10:05:02Z",
        correlationId: "corr-order-1422",
        eventSequence: 1422,
        payload: {
          entityType: "ORDER",
          entityId: orderId,
          entityVersion: 3,
          contentDigestSha256: "b".repeat(64),
          data: {
            state: "Executing",
            orderUpdateId: 2,
          },
        },
      },
    ],
  });

  updatedOrder = state.snapshot?.orders.find((o) => o.id === orderId);
  assert.ok(updatedOrder);
  assert.equal(updatedOrder.state, "Executing");
  assert.equal(updatedOrder.orderUpdateId, 2);

  const execEntry = updatedOrder.timeline?.find((t) => t.state === "Executing");
  assert.ok(execEntry);
  assert.equal(
    execEntry.isExecutionReport,
    true,
    "Executing state must have isExecutionReport=true",
  );

  // Verify timeline history length
  assert.ok(updatedOrder.timeline && updatedOrder.timeline.length >= 2);
});
