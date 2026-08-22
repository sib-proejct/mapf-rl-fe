/**
 * Canonical test fixtures for Phase 2 Realtime Reconciliation.
 */

import type { StreamEnvelope } from "../../domain/event/types.ts";

export const FIXTURE_BASE_CURSOR_SEQ = 1420;

export const NOMINAL_ROBOT_EVENT_1421: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000001421",
  messageType: "robot.state.report",
  producer: { kind: "SIMULATOR", id: "sim-01" },
  occurredAt: "2026-08-22T04:30:00.100Z",
  correlationId: "corr-1421",
  eventSequence: 1421,
  payload: {
    robotId: "robot-01",
    stateVersion: 43,
    simulationTimeMs: 12500,
    pose: { xMeters: 4.6, yMeters: 2.5, yawRadians: 0.0 },
    operationalState: "EXECUTING",
    connectivity: "CONNECTED",
    safety: "NORMAL",
    activeController: {
      mode: "BASELINE",
      identity: "cardinal-baseline/1.0.0",
    },
    batteryPercent: 94,
  },
};

export const NOMINAL_ROBOT_EVENT_1422: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000001422",
  messageType: "robot.state.report",
  producer: { kind: "SIMULATOR", id: "sim-01" },
  occurredAt: "2026-08-22T04:30:00.200Z",
  correlationId: "corr-1422",
  eventSequence: 1422,
  payload: {
    robotId: "robot-01",
    stateVersion: 44,
    simulationTimeMs: 12600,
    pose: { xMeters: 4.7, yMeters: 2.5, yawRadians: 0.0 },
    operationalState: "EXECUTING",
    connectivity: "CONNECTED",
    safety: "NORMAL",
    activeController: {
      mode: "BASELINE",
      identity: "cardinal-baseline/1.0.0",
    },
    batteryPercent: 94,
  },
};

export const DUPLICATE_STREAM_EVENT_1420: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000001420",
  messageType: "robot.state.report",
  producer: { kind: "SIMULATOR", id: "sim-01" },
  occurredAt: "2026-08-22T04:30:00.000Z",
  correlationId: "corr-1420",
  eventSequence: 1420,
  payload: {
    robotId: "robot-01",
    stateVersion: 42,
    simulationTimeMs: 12400,
    pose: { xMeters: 4.5, yMeters: 2.5, yawRadians: 0.0 },
    operationalState: "EXECUTING",
    connectivity: "CONNECTED",
    safety: "NORMAL",
    activeController: {
      mode: "BASELINE",
      identity: "cardinal-baseline/1.0.0",
      contentDigestSha256:
        "4444444444444444444444444444444444444444444444444444444444444444",
    },
    batteryPercent: 94,
  },
};

export const STALE_STREAM_EVENT_1400: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000001400",
  messageType: "robot.state.report",
  producer: { kind: "SIMULATOR", id: "sim-01" },
  occurredAt: "2026-08-22T04:20:00.000Z",
  correlationId: "corr-1400",
  eventSequence: 1400,
  payload: {
    robotId: "robot-01",
    stateVersion: 10,
    simulationTimeMs: 5000,
    pose: { xMeters: 1.0, yMeters: 1.0, yawRadians: 0.0 },
    operationalState: "IDLE",
    connectivity: "CONNECTED",
    safety: "NORMAL",
    activeController: { mode: "BASELINE", identity: "cardinal-baseline/1.0.0" },
    batteryPercent: 99,
  },
};

export const GAP_STREAM_EVENT_1425: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000001425",
  messageType: "robot.state.report",
  producer: { kind: "SIMULATOR", id: "sim-01" },
  occurredAt: "2026-08-22T04:30:00.500Z",
  correlationId: "corr-1425",
  eventSequence: 1425,
  payload: {
    robotId: "robot-01",
    stateVersion: 48,
    simulationTimeMs: 13000,
    pose: { xMeters: 5.5, yMeters: 2.5, yawRadians: 0.0 },
    operationalState: "EXECUTING",
    connectivity: "CONNECTED",
    safety: "NORMAL",
    activeController: { mode: "BASELINE", identity: "cardinal-baseline/1.0.0" },
    batteryPercent: 93,
  },
};

export const CONFLICT_STREAM_EVENT_1420: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000009999",
  messageType: "robot.state.report",
  producer: { kind: "SIMULATOR", id: "sim-01" },
  occurredAt: "2026-08-22T04:30:00.000Z",
  correlationId: "corr-conflict",
  eventSequence: 1420,
  payload: {
    robotId: "robot-01",
    stateVersion: 42,
    simulationTimeMs: 12400,
    pose: { xMeters: 999.0, yMeters: 999.0, yawRadians: 3.14159 }, // Contradictory coordinates
    operationalState: "STOPPED",
    connectivity: "DISCONNECTED",
    safety: "FAULT",
    activeController: { mode: "POLICY", identity: "faulty-policy/1.0" },
    batteryPercent: 0,
  },
};

export const ORDER_LIFECYCLE_EVENT_1421: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000001421-order",
  messageType: "operations.event",
  producer: { kind: "CORE", id: "core-01" },
  occurredAt: "2026-08-22T04:30:01.000Z",
  correlationId: "corr-order-1421",
  eventSequence: 1421,
  payload: {
    entityType: "ORDER",
    entityId: "order-01",
    eventType: "ORDER_COMPLETED",
    orderUpdateId: 1,
    state: "Completed",
    occurredAt: "2026-08-22T04:30:01.000Z",
  },
};
