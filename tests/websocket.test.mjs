import assert from "node:assert/strict";
import test from "node:test";

import { ExponentialBackoff } from "../src/services/websocket/backoff.ts";
import { BoundedEventBuffer } from "../src/state/reconciliation/boundedBuffer.ts";
import {
  adaptStreamEnvelope,
  adaptRobotStateReport,
  EventValidationError,
} from "../src/contracts/adapters/eventAdapter.ts";
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
  assert.equal(valid.messageType, "robot.state.report");

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
