/**
 * Boundary adapter and validator for inbound WebSocket messages from Core /ws/v1.
 */

import type {
  StreamEnvelope,
  StreamMessageType,
  StreamWelcomePayload,
  RobotStateReportPayload,
  RobotEventReportPayload,
  OperationsEventPayload,
} from "../../domain/event/types.ts";
import { WS_MESSAGE_TYPES } from "../generated.ts";

export class EventValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string = "MALFORMED_STREAM_MESSAGE") {
    super(message);
    this.name = "EventValidationError";
    this.code = code;
  }
}

/**
 * Validates and adapts raw WebSocket frame text or JSON into a typed StreamEnvelope.
 */
export function adaptStreamEnvelope(raw: unknown): StreamEnvelope {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new EventValidationError(
        "Failed to parse WebSocket JSON payload",
        "JSON_PARSE_ERROR",
      );
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new EventValidationError(
      "Invalid stream envelope: expected non-null object",
      "INVALID_ENVELOPE_OBJECT",
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.contractVersion !== "1.0.0") {
    throw new EventValidationError(
      `Incompatible stream contractVersion: expected "1.0.0", got "${obj.contractVersion}"`,
      "INCOMPATIBLE_CONTRACT_VERSION",
    );
  }

  const messageId = typeof obj.messageId === "string" ? obj.messageId : "";
  if (!messageId) {
    throw new EventValidationError(
      "Missing required stream field: messageId",
      "MISSING_MESSAGE_ID",
    );
  }

  const messageType = obj.messageType as StreamMessageType;
  if (
    !messageType ||
    !WS_MESSAGE_TYPES.includes(messageType as (typeof WS_MESSAGE_TYPES)[number])
  ) {
    throw new EventValidationError(
      `Unknown stream messageType: "${obj.messageType}"`,
      "UNKNOWN_MESSAGE_TYPE",
    );
  }

  const producer = obj.producer as { kind?: unknown; id?: unknown } | undefined;
  if (
    !producer ||
    (producer.kind !== "CORE" && producer.kind !== "SIMULATOR") ||
    typeof producer.id !== "string"
  ) {
    throw new EventValidationError(
      "Invalid stream producer definition",
      "INVALID_PRODUCER",
    );
  }

  const eventSequence =
    typeof obj.eventSequence === "number" &&
    Number.isInteger(obj.eventSequence) &&
    obj.eventSequence >= 0
      ? obj.eventSequence
      : typeof (obj.payload as any)?.eventSequence === "number"
        ? (obj.payload as any).eventSequence
        : typeof (obj.payload as any)?.reportSequence === "number"
          ? (obj.payload as any).reportSequence
          : 0;

  const occurredAt =
    typeof obj.occurredAt === "string"
      ? obj.occurredAt
      : new Date().toISOString();
  const correlationId =
    typeof obj.correlationId === "string" ? obj.correlationId : "";

  const payload =
    obj.payload && typeof obj.payload === "object"
      ? (obj.payload as Record<string, unknown>)
      : {};

  return {
    contractVersion: "1.0.0",
    messageId,
    messageType,
    producer: {
      kind: producer.kind as "CORE" | "SIMULATOR",
      id: producer.id,
    },
    occurredAt,
    correlationId,
    eventSequence,
    payload,
  };
}

/**
 * Validates and normalizes RobotStateReportPayload from an envelope.
 */
export function adaptRobotStateReport(
  payload: Record<string, unknown>,
): RobotStateReportPayload {
  const robotId = String(payload.robotId || "");
  if (!robotId) {
    throw new EventValidationError(
      "Missing robotId in robot.state.report",
      "MISSING_ROBOT_ID",
    );
  }

  const stateVersion =
    typeof payload.stateVersion === "number" &&
    Number.isInteger(payload.stateVersion)
      ? payload.stateVersion
      : typeof payload.reportSequence === "number"
        ? payload.reportSequence
        : 0;

  const simulationTimeMs =
    typeof payload.simulationTimeMs === "number" &&
    Number.isFinite(payload.simulationTimeMs)
      ? payload.simulationTimeMs
      : 0;

  const poseRaw = (payload.pose as Record<string, unknown>) || {};
  const xMeters = Number(poseRaw.xMeters);
  const yMeters = Number(poseRaw.yMeters);
  const yawRadians = Number(poseRaw.yawRadians);

  if (
    !Number.isFinite(xMeters) ||
    !Number.isFinite(yMeters) ||
    !Number.isFinite(yawRadians)
  ) {
    throw new EventValidationError(
      "Invalid pose coordinates in robot.state.report: non-finite value detected",
      "INVALID_POSE_COORDINATES",
    );
  }

  const operationalState = (
    ["IDLE", "EXECUTING", "HELD", "STOPPED"].includes(
      String(payload.operationalState || payload.state).toUpperCase(),
    )
      ? String(payload.operationalState || payload.state).toUpperCase()
      : "IDLE"
  ) as any;

  const connectivity = (
    ["CONNECTED", "DEGRADED", "DISCONNECTED"].includes(
      String(payload.connectivity).toUpperCase(),
    )
      ? String(payload.connectivity).toUpperCase()
      : "CONNECTED"
  ) as any;

  const safety = (
    [
      "NORMAL",
      "WAIT",
      "CONTROLLED_STOP",
      "EMERGENCY_STOP",
      "REJECT",
      "FAULT",
    ].includes(String(payload.safety).toUpperCase())
      ? String(payload.safety).toUpperCase()
      : "NORMAL"
  ) as any;

  const controllerRaw =
    (payload.activeController as Record<string, unknown>) || {};
  const activeController = {
    mode:
      typeof controllerRaw.mode === "string" ? controllerRaw.mode : "BASELINE",
    identity:
      typeof controllerRaw.identity === "string"
        ? controllerRaw.identity
        : "cardinal-baseline/1.0.0",
    contentDigestSha256:
      typeof controllerRaw.contentDigestSha256 === "string"
        ? controllerRaw.contentDigestSha256
        : undefined,
  };

  const batteryPercent =
    typeof payload.batteryPercent === "number" &&
    Number.isFinite(payload.batteryPercent)
      ? Math.max(0, Math.min(100, payload.batteryPercent))
      : undefined;

  return {
    robotId,
    stateVersion,
    simulationTimeMs,
    pose: { xMeters, yMeters, yawRadians },
    operationalState,
    connectivity,
    safety,
    activeController,
    batteryPercent,
    orderId: typeof payload.orderId === "string" ? payload.orderId : undefined,
    orderUpdateId:
      typeof payload.orderUpdateId === "number"
        ? payload.orderUpdateId
        : undefined,
    sessionEpoch:
      typeof payload.sessionEpoch === "number"
        ? payload.sessionEpoch
        : undefined,
    simulatorId:
      typeof payload.simulatorId === "string" ? payload.simulatorId : undefined,
    contentDigestSha256:
      typeof payload.contentDigestSha256 === "string"
        ? payload.contentDigestSha256
        : undefined,
  };
}

/**
 * Validates and normalizes OperationsEventPayload from an envelope.
 */
export function adaptOperationsEvent(
  payload: Record<string, unknown>,
): OperationsEventPayload {
  const entityType =
    payload.entityType === "ORDER" ||
    payload.entityType === "MAP" ||
    payload.entityType === "FLEET"
      ? payload.entityType
      : "ORDER";

  const entityId = String(payload.entityId || payload.orderId || "");
  const eventType = String(payload.eventType || "ORDER_UPDATED") as any;

  const orderUpdateId =
    typeof payload.orderUpdateId === "number"
      ? payload.orderUpdateId
      : undefined;
  const planRevisionId =
    typeof payload.planRevisionId === "string"
      ? payload.planRevisionId
      : undefined;
  const state =
    typeof payload.state === "string" ? (payload.state as any) : undefined;

  const assignments = Array.isArray(payload.assignments)
    ? payload.assignments.map((a: any) => ({
        robotId: String(a.robotId || ""),
        goalColumn: Number(a.goalColumn) || 0,
        goalRow: Number(a.goalRow) || 0,
      }))
    : undefined;

  return {
    entityType,
    entityId,
    eventType,
    orderUpdateId,
    planRevisionId,
    state,
    assignments,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
    occurredAt:
      typeof payload.occurredAt === "string" ? payload.occurredAt : undefined,
  };
}
