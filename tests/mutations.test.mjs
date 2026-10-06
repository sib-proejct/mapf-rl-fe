import assert from "node:assert/strict";
import test from "node:test";

import { MutationManager } from "../src/state/mutations/mutationManager.ts";
import { generateUuidV4, computePayloadDigest } from "../src/utils/ids/ids.ts";
import { adaptOperationsSnapshot } from "../src/contracts/adapters/snapshotAdapter.ts";
import { CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE } from "../src/contracts/fixtures/canonical.ts";

test("UUIDv4 generation: conforms to RFC 4122 format and generates distinct identifiers", () => {
  const id1 = generateUuidV4();
  const id2 = generateUuidV4();

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assert.match(id1, uuidRegex, "id1 must match RFC 4122 v4 regex");
  assert.match(id2, uuidRegex, "id2 must match RFC 4122 v4 regex");
  assert.notEqual(id1, id2, "Generated UUIDs must be unique");
});

test("Double-click protection: prevent identical mutation submissions while in-flight", () => {
  const manager = new MutationManager();
  const payload = {
    mapId: "00000000-0000-4000-8000-000000000001",
    assignments: [{ robotId: "robot-01", goalColumn: 10, goalRow: 12 }],
  };

  // First click starts mutation
  const mut1 = manager.startMutation("CREATE_ORDER", payload);
  assert.equal(mut1.state, "submitting");
  assert.ok(mut1.requestId);

  // Immediate second click with identical payload while in-flight must throw
  assert.throws(
    () => {
      manager.startMutation("CREATE_ORDER", payload);
    },
    /Duplicate mutation in-flight/,
    "Double-click must be rejected with duplicate in-flight error",
  );

  // Confirming the mutation frees up the digest lock
  manager.confirmMutation(mut1.requestId, {
    status: "CONFIRMED",
    entityId: "order-9999",
  });

  assert.equal(manager.get(mut1.requestId)?.state, "confirmed");

  // Subsequent new request can now proceed
  const mut2 = manager.startMutation("CREATE_ORDER", payload);
  assert.notEqual(mut2.requestId, mut1.requestId);
});

test("Uncertain outcome: mutation timeout marks state as uncertain rather than failed", () => {
  const manager = new MutationManager();
  const payload = {
    orderId: "order-01",
    orderUpdateId: 1,
    reason: "Cancelling due to obstruction",
  };

  const mut = manager.startMutation("CANCEL_ORDER", payload, "order-01", 1);
  assert.equal(mut.state, "submitting");

  // Network timeout occurs
  manager.markUncertain(
    mut.requestId,
    "Gateway timeout after 8000ms. Server state unknown.",
  );

  const updated = manager.get(mut.requestId);
  assert.ok(updated);
  assert.equal(updated.state, "uncertain");
  assert.match(updated.error?.detail || "", /Gateway timeout/);
});

test("Idempotent Retry: retrying an uncertain mutation retains the exact same requestId", () => {
  const manager = new MutationManager();
  const payload = {
    mapId: "00000000-0000-4000-8000-000000000001",
    assignments: [{ robotId: "robot-02", goalColumn: 15, goalRow: 18 }],
  };

  const initialMut = manager.startMutation("CREATE_ORDER", payload);
  const initialRequestId = initialMut.requestId;

  // Mark uncertain
  manager.markUncertain(initialRequestId, "Connection lost");
  assert.equal(manager.get(initialRequestId)?.state, "uncertain");

  // Retry with forced/same requestId
  const retryMut = manager.startMutation(
    "CREATE_ORDER",
    payload,
    undefined,
    undefined,
    initialRequestId,
  );

  assert.equal(
    retryMut.requestId,
    initialRequestId,
    "Retried mutation must preserve the original UUIDv4 requestId",
  );
  assert.equal(retryMut.attemptCount, 2);
  assert.equal(retryMut.state, "submitting");
});

test("Reconnection Reconciliation: reconciles uncertain mutation against fresh authoritative snapshot", () => {
  const manager = new MutationManager();
  const baseSnapshot = adaptOperationsSnapshot(
    CANONICAL_OPERATIONS_SNAPSHOT_FIXTURE,
  );

  // Scenario 1: Uncertain cancel order where snapshot shows order is now cancelled
  const cancelPayload = {
    orderId: "order-01",
    orderUpdateId: 0,
  };
  const cancelMut = manager.startMutation(
    "CANCEL_ORDER",
    cancelPayload,
    "order-01",
    0,
  );
  manager.markUncertain(cancelMut.requestId, "Timeout during cancel");

  // Create fresh snapshot where order-01 is Cancelled
  const reconnectedSnapshot = {
    ...baseSnapshot,
    orders: baseSnapshot.orders.map((o) =>
      o.id === "order-01" ? { ...o, state: "Cancelled", orderUpdateId: 1 } : o,
    ),
  };

  // Reconcile
  manager.reconcileWithSnapshot(reconnectedSnapshot);

  const reconciledMut = manager.get(cancelMut.requestId);
  assert.ok(reconciledMut);
  assert.equal(
    reconciledMut.state,
    "confirmed",
    "Uncertain cancel must reconcile to confirmed when snapshot reflects Cancelled state",
  );
});

test("map round trip clears previous intents and locks and rejects old request IDs", () => {
  const manager = new MutationManager();
  manager.setMapGeneration(7);
  const payload = { mapId: "standard", task: { robotId: "r-001", steps: [] } };
  const submitting = manager.startMutation("CREATE_ORDER", payload);
  const uncertain = manager.startMutation("CANCEL_ORDER", {
    orderId: "old-order",
  });
  manager.markUncertain(uncertain.requestId);
  assert.equal(submitting.mapGeneration, 7);
  manager.setMapGeneration(7);
  assert.equal(manager.get(submitting.requestId), submitting);

  const notifications = [];
  manager.subscribe((mutations) => notifications.push(mutations.length));
  manager.setMapGeneration(8);
  manager.setMapGeneration(9);
  assert.deepEqual(manager.getAll(), []);
  assert.deepEqual(notifications, [2, 0, 0]);
  for (const mutation of [submitting, uncertain]) {
    assert.throws(
      () =>
        manager.startMutation(
          mutation.operation,
          mutation.payload,
          undefined,
          undefined,
          mutation.requestId,
        ),
      /이전 요청을 재시도할 수 없습니다/,
    );
  }
  // Responses and timeouts from the old generation must not restore its requests.
  assert.equal(manager.confirmMutation(submitting.requestId), undefined);
  assert.equal(manager.markUncertain(uncertain.requestId), undefined);
  const fresh = manager.startMutation("CREATE_ORDER", payload);
  assert.equal(fresh.mapGeneration, 9);
  assert.notEqual(fresh.requestId, submitting.requestId);
});
