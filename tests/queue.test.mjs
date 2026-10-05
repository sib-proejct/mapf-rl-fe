import assert from "node:assert/strict";
import test from "node:test";
import { CoreApiClient, ProblemError } from "../src/services/api/client.ts";
import {
  adaptQueueTask,
  queueWaves,
} from "../src/contracts/adapters/queueAdapter.ts";
import {
  adaptOperationsSnapshot as adaptSnapshot,
  DEFAULT_CANONICAL_MAP,
} from "../src/contracts/adapters/snapshotAdapter.ts";
import { adaptOperationsEvent } from "../src/contracts/adapters/eventAdapter.ts";

const id = "60000000-0000-4000-8000-000000000001";
const task = {
  contractVersion: "1.0.0",
  taskId: id,
  requestId: id,
  sequence: 1,
  mapId: id,
  mapRevision: 1,
  waveId: id,
  robotId: null,
  requestedRobotId: null,
  steps: [
    { goalColumn: 2, goalRow: 2, arrivalAction: "PICK" },
    { goalColumn: 4, goalRow: 2, arrivalAction: "PLACE" },
  ],
  stage: 0,
  state: "Queued",
  reason: null,
  orderId: null,
  orderIds: [],
  entityVersion: 1,
  createdAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
};

test("manual and automatic submissions register durable queue intents", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return Response.json({ taskId: id, state: "Queued" });
  };
  const client = new CoreApiClient("", () => "csrf");
  const map = { mapId: id, mapRevision: 1 };
  const outcome = await client.enqueueOrder(
    {
      ...map,
      assignments: [
        {
          robotId: "busy-robot",
          goalColumn: 2,
          goalRow: 2,
          arrivalAction: "PICK",
        },
      ],
    },
    { requestId: id },
  );
  assert.equal(outcome.entityId, id);
  assert.equal(requests[0].url, "/api/v1/queue/tasks");
  assert.deepEqual(requests[0].body.task, {
    robotId: "busy-robot",
    steps: [{ goalColumn: 2, goalRow: 2, arrivalAction: "PICK" }],
  });
  await client.enqueueOrder(
    { ...map, goalColumn: 4, goalRow: 2 },
    { requestId: id },
  );
  assert.deepEqual(requests[1].body.task, {
    steps: [{ goalColumn: 4, goalRow: 2 }],
  });
});

test("wave timeout retries the same request and full batch", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, body: init.body });
    if (requests.length === 1) throw new DOMException("timeout", "AbortError");
    return Response.json({ waveId: id, taskIds: [id], state: "Queued" });
  };
  const client = new CoreApiClient("", () => "csrf");
  const payload = { mapId: id, mapRevision: 1, tasks: [{ steps: task.steps }] };
  await assert.rejects(
    client.enqueueOrder(payload, { requestId: id }),
    (error) =>
      error instanceof ProblemError &&
      error.problem.code === "MUTATION_TIMEOUT_UNCERTAIN",
  );
  const outcome = await client.enqueueOrder(payload, { requestId: id });
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[1].url, "/api/v1/waves");
  assert.equal(outcome.entityId, id);
});

test("queue adapters validate stage/action and aggregate partial wave outcomes", () => {
  assert.deepEqual(adaptQueueTask(task), task);
  assert.throws(() => adaptQueueTask({ ...task, stage: 2 }));
  assert.throws(() =>
    adaptQueueTask({ ...task, steps: task.steps.slice().reverse() }),
  );
  const tasks = [
    task,
    {
      ...task,
      taskId: "second",
      sequence: 2,
      state: "Held",
      reason: "CARGO_RECOVERY_REQUIRED",
    },
  ];
  const wave = queueWaves(tasks)[0];
  assert.equal(wave.counts.Queued, 1);
  assert.equal(wave.counts.Held, 1);
});

test("snapshot and event carry queue identity and version", () => {
  const payload = {
    entityType: "QUEUE_TASK",
    entityId: id,
    entityVersion: 1,
    contentDigestSha256: "a".repeat(64),
    data: task,
  };
  const snapshot = adaptOperationsSnapshot({
    contractVersion: "1.0.0",
    snapshotAt: task.createdAt,
    cursor: { streamId: "operations", eventSequence: 1 },
    freshness: "CURRENT",
    entities: [payload],
  });
  assert.deepEqual(snapshot.queueTasks, [task]);
  assert.equal(adaptOperationsEvent(payload).entityType, "QUEUE_TASK");
  assert.throws(() =>
    adaptOperationsSnapshot({
      contractVersion: "1.0.0",
      entities: [{ ...payload, entityId: "mismatch" }],
    }),
  );
});

test("queue events ignore duplicate/stale versions and snapshots recover uncertain writes", async () => {
  const { reconciliationReducer, INITIAL_RECONCILIATION_STATE } = await import(
    "../src/state/reconciliation/reducer.ts"
  );
  const { MutationManager } = await import(
    "../src/state/mutations/mutationManager.ts"
  );
  const snapshot = adaptOperationsSnapshot({
    contractVersion: "1.0.0",
    snapshotAt: task.createdAt,
    cursor: { streamId: "operations", eventSequence: 1 },
    freshness: "CURRENT",
    entities: [],
  });
  let state = reconciliationReducer(INITIAL_RECONCILIATION_STATE, {
    type: "SNAPSHOT_REPLACED",
    snapshot,
  });
  const event = (sequence, version, data) => ({
    contractVersion: "1.0.0",
    messageId: `queue-${sequence}`,
    messageType: "operations.event",
    producer: { kind: "CORE", id: "core" },
    occurredAt: task.createdAt,
    correlationId: id,
    eventSequence: sequence,
    payload: {
      entityType: "QUEUE_TASK",
      entityId: id,
      entityVersion: version,
      contentDigestSha256: String(version).repeat(64),
      data,
    },
  });
  state = reconciliationReducer(state, {
    type: "STREAM_EVENT_RECEIVED",
    event: event(2, 2, { ...task, entityVersion: 2, state: "Running" }),
  });
  state = reconciliationReducer(state, {
    type: "STREAM_EVENT_RECEIVED",
    event: event(3, 2, { ...task, entityVersion: 2, state: "Running" }),
  });
  state = reconciliationReducer(state, {
    type: "STREAM_EVENT_RECEIVED",
    event: event(4, 1, task),
  });
  assert.equal(state.snapshot.queueTasks.length, 1);
  assert.equal(state.snapshot.queueTasks[0].state, "Running");
  const manager = new MutationManager();
  const creation = manager.startMutation(
    "CREATE_ORDER",
    { tasks: [{ steps: task.steps }] },
    undefined,
    undefined,
    id,
  );
  manager.markUncertain(creation.requestId, "timeout");
  manager.reconcileWithSnapshot({ ...snapshot, queueTasks: [task] });
  assert.equal(manager.get(id).state, "confirmed");
  const cancellation = manager.startMutation(
    "CANCEL_QUEUE_TASK",
    { taskId: id },
    id,
  );
  manager.markUncertain(cancellation.requestId, "timeout");
  manager.reconcileWithSnapshot({
    ...snapshot,
    queueTasks: [{ ...task, state: "Cancelling" }],
  });
  assert.equal(manager.get(cancellation.requestId).state, "confirmed");
});

// Queue-only fixtures explicitly supply a map; production snapshots must contain one.
const adaptOperationsSnapshot = (raw) =>
  adaptSnapshot(raw, DEFAULT_CANONICAL_MAP);
