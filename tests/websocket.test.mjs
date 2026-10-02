import assert from "node:assert/strict";
import test from "node:test";

import { ExponentialBackoff } from "../src/services/websocket/backoff.ts";
import { BoundedEventBuffer } from "../src/state/reconciliation/boundedBuffer.ts";
import {
  adaptStreamEnvelope,
  adaptRobotStateReport,
  adaptOperationsEvent,
  EventValidationError,
} from "../src/contracts/adapters/eventAdapter.ts";
import { CoreWsClient } from "../src/services/websocket/client.ts";
import {
  NOMINAL_ROBOT_EVENT_1421,
  NOMINAL_ROBOT_EVENT_1422,
} from "../src/contracts/fixtures/reconciliationFixtures.ts";

test("ExponentialBackoff: produces jittered delays bounded by base and max delay", () => {
  const backoff = new ExponentialBackoff({
    baseDelayMs: 250,
    maxDelayMs: 2000,
  });

  assert.equal(backoff.currentAttempt, 0);

  for (let i = 0; i < 5; i++) {
    const delay = backoff.nextDelay();
    assert.ok(delay >= 0, "Delay must be non-negative");
    assert.ok(delay <= 2000, "Delay must not exceed maxDelayMs");
  }

  assert.equal(backoff.currentAttempt, 5);
  backoff.reset();
  assert.equal(backoff.currentAttempt, 0);
});

test("BoundedEventBuffer: maintains sequence order and detects overflow", () => {
  const buffer = new BoundedEventBuffer({ maxCapacity: 2 });

  // Push out of order: 1422 then 1421
  const push1 = buffer.push(NOMINAL_ROBOT_EVENT_1422);
  const push2 = buffer.push(NOMINAL_ROBOT_EVENT_1421);

  assert.ok(push1);
  assert.ok(push2);
  assert.equal(buffer.size, 2);

  // Verify sorted order
  const array = buffer.toArray();
  assert.equal(array[0].eventSequence, 1421);
  assert.equal(array[1].eventSequence, 1422);

  // Overflow on 3rd item
  const push3 = buffer.push({
    ...NOMINAL_ROBOT_EVENT_1421,
    messageId: "overflow-item",
    eventSequence: 1423,
  });

  assert.equal(push3, false);
  assert.equal(buffer.hasOverflow, true);

  // Trim before 1422
  buffer.trimBefore(1422);
  assert.equal(buffer.size, 1);
  assert.equal(buffer.toArray()[0].eventSequence, 1422);
});

test("adaptStreamEnvelope: validates contract version and rejects unknown message types", () => {
  // Valid envelope
  const valid = adaptStreamEnvelope(NOMINAL_ROBOT_EVENT_1421);
  assert.equal(valid.contractVersion, "1.0.0");
  assert.equal(valid.messageType, "operations.event");

  // Incompatible version
  assert.throws(() => {
    adaptStreamEnvelope({
      ...NOMINAL_ROBOT_EVENT_1421,
      contractVersion: "2.0.0",
    });
  }, /Incompatible stream contractVersion/);

  // Unknown message type
  assert.throws(() => {
    adaptStreamEnvelope({
      ...NOMINAL_ROBOT_EVENT_1421,
      messageType: "unknown.type.fake",
    });
  }, /Unknown stream messageType/);

  // Missing messageId
  assert.throws(() => {
    adaptStreamEnvelope({
      ...NOMINAL_ROBOT_EVENT_1421,
      messageId: "",
    });
  }, /Missing required stream field: messageId/);
});

test("adaptRobotStateReport: rejects non-finite pose coordinates", () => {
  assert.throws(() => {
    adaptRobotStateReport({
      robotId: "robot-01",
      pose: { xMeters: NaN, yMeters: 2.5, yawRadians: 0.0 },
    });
  }, /non-finite value detected/);

  assert.throws(() => {
    adaptRobotStateReport({
      robotId: "robot-01",
      pose: { xMeters: Infinity, yMeters: 2.5, yawRadians: 0.0 },
    });
  }, /non-finite value detected/);
});

test("adaptOperationsEvent: consumes Core data and rejects unsupported entity types", () => {
  const event = adaptOperationsEvent(NOMINAL_ROBOT_EVENT_1421.payload);
  assert.equal(event.entityType, "ROBOT");
  assert.equal(event.entityVersion, 43);
  assert.equal(event.data.pose.xMeters, 4.6);

  assert.throws(
    () =>
      adaptOperationsEvent({
        ...NOMINAL_ROBOT_EVENT_1421.payload,
        entityType: "NOT_A_CORE_ENTITY",
      }),
    /Unknown operations entityType/,
  );
});

test("CoreWsClient: requests reconciliation through onConnected on open", () => {
  const originalWebSocket = globalThis.WebSocket;
  const sockets = [];
  class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;

    constructor() {
      this.readyState = FakeWebSocket.CONNECTING;
      sockets.push(this);
    }

    close() {
      this.readyState = 3;
    }
  }
  globalThis.WebSocket = FakeWebSocket;

  try {
    let connected = 0;
    const client = new CoreWsClient({ onConnected: () => connected++ });
    client.connect();
    sockets[0].readyState = FakeWebSocket.OPEN;
    sockets[0].onopen();
    assert.equal(connected, 1);
    assert.equal(client.state, "Reconciling");
    client.disconnect();
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});
