/** Fixtures matching the Core-produced `operations.event` envelope. */

import type { StreamEnvelope } from "../../domain/event/types.ts";

export const FIXTURE_BASE_CURSOR_SEQ = 1420;

const robotData = (
  stateVersion: number,
  xMeters: number,
  overrides: Record<string, unknown> = {},
) => ({
  stateVersion,
  simulationTimeMs: 12400 + (stateVersion - 42) * 100,
  pose: { xMeters, yMeters: 2.5, yawRadians: 0 },
  operationalState: "EXECUTING",
  connectivity: "CONNECTED",
  freshness: "CURRENT",
  safety: "NORMAL",
  activeController: {
    mode: "BASELINE",
    identity: "cardinal-baseline/1.0.0",
    contentDigestSha256: "4".repeat(64),
  },
  simulatorId: "sim-01",
  sessionEpoch: 4,
  batteryPercent: 94,
  observedAt: "2026-08-22T04:30:00.000Z",
  ...overrides,
});

const operation = (
  sequence: number,
  entityVersion: number,
  digest: string,
  data: Record<string, unknown>,
): StreamEnvelope => ({
  contractVersion: "1.0.0",
  messageId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  messageType: "operations.event",
  producer: { kind: "CORE", id: "core-api" },
  occurredAt: "2026-08-22T04:30:00.000Z",
  correlationId: `corr-${sequence}`,
  eventSequence: sequence,
  payload: {
    entityType: "ROBOT",
    entityId: "robot-01",
    entityVersion,
    contentDigestSha256: digest,
    data,
  },
});

export const NOMINAL_ROBOT_EVENT_1421 = operation(
  1421,
  43,
  "9".repeat(64),
  robotData(43, 4.6),
);

export const NOMINAL_ROBOT_EVENT_1422 = operation(
  1422,
  44,
  "a".repeat(64),
  robotData(44, 4.7),
);

export const DUPLICATE_STREAM_EVENT_1420 = operation(
  1420,
  42,
  "2".repeat(64),
  robotData(42, 4.5),
);

export const STALE_STREAM_EVENT_1400 = operation(
  1400,
  10,
  "b".repeat(64),
  robotData(10, 1, {
    simulationTimeMs: 5000,
    operationalState: "IDLE",
    batteryPercent: 99,
  }),
);

export const GAP_STREAM_EVENT_1425 = operation(
  1425,
  48,
  "c".repeat(64),
  robotData(48, 5.5),
);

export const CONFLICT_STREAM_EVENT_1420 = operation(
  1420,
  42,
  "f".repeat(64),
  robotData(42, 999, {
    pose: { xMeters: 999, yMeters: 999, yawRadians: 3.14159 },
    operationalState: "STOPPED",
    connectivity: "DISCONNECTED",
    safety: "FAULT",
    batteryPercent: 0,
  }),
);

export const ORDER_LIFECYCLE_EVENT_1421: StreamEnvelope = {
  contractVersion: "1.0.0",
  messageId: "00000000-0000-4000-8000-000000001421",
  messageType: "operations.event",
  producer: { kind: "CORE", id: "core-api" },
  occurredAt: "2026-08-22T04:30:01.000Z",
  correlationId: "corr-order-1421",
  eventSequence: 1421,
  payload: {
    entityType: "ORDER",
    entityId: "order-01",
    entityVersion: 2,
    contentDigestSha256: "d".repeat(64),
    data: {
      state: "Completed",
      orderUpdateId: 0,
    },
  },
};
