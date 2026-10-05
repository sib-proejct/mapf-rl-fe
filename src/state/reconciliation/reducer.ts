import { adaptPlannedRoute } from "../../contracts/adapters/plannedRouteAdapter.ts";
import { adaptBufferState } from "../../contracts/adapters/bufferAdapter.ts";
import { adaptQueueTask } from "../../contracts/adapters/queueAdapter.ts";
/** Pure reconciliation state machine for the canonical Core operations stream. */

import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import type {
  ConnectivityState,
  FreshnessState,
  Robot,
} from "../../domain/robot/types.ts";
import type {
  Order,
  OrderLifecycleState,
  OrderAssignment,
  OrderTimelineEntry,
} from "../../domain/order/types.ts";
import type {
  Incident,
  IncidentSeverity,
  IncidentCategory,
  IncidentStatus,
} from "../../domain/incident/types.ts";
import type {
  StreamEnvelope,
  ReconciliationState,
  ReconciliationDecision,
  ReconciliationDiagnostics,
  OperationsEventPayload,
  ConnectionState,
  StreamTransportMode,
} from "../../domain/event/types.ts";
import {
  adaptOperationsEvent,
  adaptRobotStateReport,
} from "../../contracts/adapters/eventAdapter.ts";
import { adaptArrivalAction } from "../../contracts/adapters/stationAdapter.ts";
import { adaptRasterMap } from "../../contracts/adapters/mapAdapter.ts";

export type ReconciliationAction =
  | {
      type: "TELEMETRY_RECEIVED";
      robotId: string;
      data: Record<string, unknown>;
    }
  | { type: "TELEMETRY_STALE" }
  | {
      type: "SNAPSHOT_REPLACED";
      snapshot: AuthoritativeSnapshot;
      bufferedEvents?: StreamEnvelope[];
    }
  | { type: "SNAPSHOT_LOAD_FAILED" }
  | { type: "STREAM_EVENT_RECEIVED"; event: StreamEnvelope }
  | { type: "STREAM_BATCH_RECEIVED"; events: StreamEnvelope[] }
  | { type: "CONNECTION_STATE_CHANGED"; connectionState: ConnectionState }
  | { type: "TRANSPORT_MODE_CHANGED"; transportMode: StreamTransportMode }
  | { type: "GAP_RECONCILIATION_REQUESTED"; expected: number; received: number }
  | { type: "RESET_DIAGNOSTICS" }
  | {
      type: "INCIDENT_ACKNOWLEDGED";
      incidentId: string;
      acknowledgedBy?: string;
      occurredAtUtc: string;
    }
  | {
      type: "INCIDENT_RESOLVED";
      incidentId: string;
      occurredAtUtc: string;
    }
  | {
      type: "ORDER_CREATED_OPTIMISTIC";
      order: Order;
    }
  | {
      type: "ORDER_CANCELLED_CONFIRMED";
      orderId: string;
      orderUpdateId: number;
      occurredAtUtc: string;
    }
  | {
      type: "ORDER_REASSIGNED_CONFIRMED";
      orderId: string;
      orderUpdateId: number;
      assignments: OrderAssignment[];
      occurredAtUtc: string;
    }
  | {
      type: "ROBOT_INSTANT_ACTION_APPLIED";
      robotId: string;
      action: string;
      occurredAtUtc: string;
    };

export const INITIAL_DIAGNOSTICS: ReconciliationDiagnostics = {
  duplicateCount: 0,
  staleCount: 0,
  conflictCount: 0,
  gapCount: 0,
  coalescedCount: 0,
  totalEventsProcessed: 0,
  lastReconciledAt: null,
  lastDecision: null,
};

export const INITIAL_RECONCILIATION_STATE: ReconciliationState = {
  snapshot: null,
  connectionState: "LoadingSnapshot",
  transportMode: "LIVE_WEBSOCKET",
  cursor: { streamId: "operations", eventSequence: 0 },
  diagnostics: INITIAL_DIAGNOSTICS,
};

interface ApplyResult {
  nextSnapshot: AuthoritativeSnapshot | null;
  decision: ReconciliationDecision;
  nextSequence: number;
  conflictReason?: string;
  gapDetails?: { expected: number; received: number };
}

export function applySingleEvent(
  snapshot: AuthoritativeSnapshot | null,
  event: StreamEnvelope,
  currentSequence: number,
): ApplyResult {
  if (!snapshot) {
    return {
      nextSnapshot: null,
      decision: "STALE",
      nextSequence: currentSequence,
    };
  }
  const sequence = event.eventSequence;
  if (sequence > currentSequence + 1) {
    return {
      nextSnapshot: { ...snapshot, freshness: "RECONCILING" },
      decision: "GAP",
      nextSequence: currentSequence,
      gapDetails: { expected: currentSequence + 1, received: sequence },
    };
  }

  const operation =
    event.messageType === "operations.event"
      ? adaptOperationsEvent(event.payload as Record<string, unknown>)
      : null;
  if (sequence <= currentSequence) {
    return classifyAlreadyObserved(snapshot, operation, currentSequence);
  }
  if (!operation) {
    return {
      nextSnapshot: advanceCursor(snapshot, sequence),
      decision: "APPLIED",
      nextSequence: sequence,
    };
  }

  if (operation.entityType === "ORDER") {
    const currentOrder = snapshot.orders.find(
      (order) => order.id === operation.entityId,
    );
    if (
      currentOrder &&
      typeof operation.data.orderUpdateId === "number" &&
      operation.data.orderUpdateId < currentOrder.orderUpdateId
    ) {
      return {
        nextSnapshot: advanceCursor(snapshot, sequence),
        decision: "STALE",
        nextSequence: sequence,
      };
    }
  }

  const existing = snapshot.entityVersions[entityKey(operation)];
  if (existing && operation.entityVersion < existing.version) {
    return {
      nextSnapshot: advanceCursor(snapshot, sequence),
      decision: "STALE",
      nextSequence: sequence,
    };
  }
  if (existing && operation.entityVersion === existing.version) {
    if (operation.contentDigestSha256 === existing.contentDigestSha256) {
      return {
        nextSnapshot: advanceCursor(snapshot, sequence),
        decision: "DUPLICATE",
        nextSequence: sequence,
      };
    }
    return entityConflict(snapshot, currentSequence, operation);
  }

  const applied = applyOperation(snapshot, event, operation);
  return {
    nextSnapshot: advanceCursor(applied, sequence),
    decision: "APPLIED",
    nextSequence: sequence,
  };
}

function classifyAlreadyObserved(
  snapshot: AuthoritativeSnapshot,
  operation: OperationsEventPayload | null,
  currentSequence: number,
): ApplyResult {
  if (!operation) {
    return {
      nextSnapshot: snapshot,
      decision: "DUPLICATE",
      nextSequence: currentSequence,
    };
  }
  const existing = snapshot.entityVersions[entityKey(operation)];
  if (existing && operation.entityVersion < existing.version) {
    return {
      nextSnapshot: snapshot,
      decision: "STALE",
      nextSequence: currentSequence,
    };
  }
  if (
    existing &&
    operation.entityVersion === existing.version &&
    operation.contentDigestSha256 !== existing.contentDigestSha256
  ) {
    return entityConflict(snapshot, currentSequence, operation);
  }
  if (existing && operation.entityVersion > existing.version) {
    return entityConflict(snapshot, currentSequence, operation);
  }
  return {
    nextSnapshot: snapshot,
    decision: "DUPLICATE",
    nextSequence: currentSequence,
  };
}

function entityConflict(
  snapshot: AuthoritativeSnapshot,
  currentSequence: number,
  operation: OperationsEventPayload,
): ApplyResult {
  return {
    nextSnapshot: { ...snapshot, freshness: "RECONCILING" },
    decision: "CONFLICT",
    nextSequence: currentSequence,
    conflictReason: `Conflicting ${operation.entityType} ${operation.entityId} at entityVersion ${operation.entityVersion}`,
  };
}

function applyOperation(
  snapshot: AuthoritativeSnapshot,
  event: StreamEnvelope,
  operation: OperationsEventPayload,
): AuthoritativeSnapshot {
  let next = snapshot;
  if (operation.entityType === "MAP") {
    const map = adaptRasterMap(operation.data);
    if (
      map.mapId !== operation.entityId ||
      map.revision !== operation.entityVersion ||
      map.contentDigestSha256 !== operation.contentDigestSha256
    ) {
      throw new Error(
        "MAP operations event identity does not match payload.data",
      );
    }
    next = { ...next, map };
  } else if (operation.entityType === "ROBOT") {
    next = applyRobot(next, event, operation);
  } else if (operation.entityType === "BUFFER_STATE") {
    const state = adaptBufferState(operation.data);
    if (
      state.robotId !== operation.entityId ||
      state.entityVersion !== operation.entityVersion
    )
      throw new Error("Buffer state envelope mismatch");
    next = {
      ...next,
      bufferStates: { ...next.bufferStates, [state.robotId]: state },
      robots: next.robots.map((robot) =>
        robot.id === state.robotId ? { ...robot, bufferState: state } : robot,
      ),
    };
  } else if (operation.entityType === "QUEUE_TASK") {
    const task = adaptQueueTask(operation.data);
    if (
      task.taskId !== operation.entityId ||
      task.entityVersion !== operation.entityVersion
    )
      throw new Error("Queue task envelope mismatch");
    next = {
      ...next,
      queueTasks: [
        ...(next.queueTasks ?? []).filter(
          (item) => item.taskId !== task.taskId,
        ),
        task,
      ].sort((a, b) => a.sequence - b.sequence),
    };
  } else if (operation.entityType === "ORDER") {
    next = applyOrder(next, event, operation);
  } else if (operation.entityType === "CONNECTIVITY") {
    next = applyConnectivity(next, operation);
  } else if (operation.entityType === "INCIDENT") {
    next = applyIncident(next, event, operation);
  }
  return {
    ...next,
    entityVersions: {
      ...next.entityVersions,
      [entityKey(operation)]: {
        version: operation.entityVersion,
        contentDigestSha256: operation.contentDigestSha256,
      },
    },
  };
}

function applyRobot(
  snapshot: AuthoritativeSnapshot,
  event: StreamEnvelope,
  operation: OperationsEventPayload,
): AuthoritativeSnapshot {
  const payload = adaptRobotStateReport({
    ...operation.data,
    robotId: operation.entityId,
    stateVersion: operation.entityVersion,
  });
  const existing = snapshot.robots.find(
    (robot) => robot.id === operation.entityId,
  );
  const epoch = payload.sessionEpoch ?? existing?.sessionEpoch;
  const boot =
    typeof operation.data.simulatorBootId === "string"
      ? operation.data.simulatorBootId
      : existing?.simulatorBootId;
  if (
    existing &&
    ((epoch ?? 0) < (existing.sessionEpoch ?? 0) ||
      (epoch === existing.sessionEpoch &&
        ((existing.simulatorBootId !== undefined &&
          boot !== existing.simulatorBootId) ||
          operation.entityVersion < (existing.stateVersion ?? 0))))
  )
    return snapshot;
  const robot: Robot = {
    id: operation.entityId,
    contentDigestSha256: operation.contentDigestSha256,
    stateVersion: operation.entityVersion,
    simulationTimeMs: payload.simulationTimeMs,
    occurredAtUtc:
      typeof operation.data.observedAt === "string"
        ? operation.data.observedAt
        : event.occurredAt,
    pose: payload.pose,
    operationalState: payload.operationalState,
    connectivity: payload.connectivity,
    freshness: "CURRENT",
    safety: payload.safety,
    activeController: payload.activeController,
    currentOrderId: payload.orderId,
    orderUpdateId: payload.orderUpdateId,
    sessionEpoch: epoch,
    simulatorBootId: boot,
    simulatorId: payload.simulatorId,
    stationActionsVersion: payload.stationActionsVersion,
    stationState: payload.stationState,
    trafficWait: payload.trafficWait,
    bufferState:
      snapshot.bufferStates?.[operation.entityId] ?? existing?.bufferState,
    batteryPercent: payload.batteryPercent ?? existing?.batteryPercent ?? 100,
  };
  return {
    ...snapshot,
    robots: existing
      ? snapshot.robots.map((value) => (value.id === robot.id ? robot : value))
      : [...snapshot.robots, robot],
  };
}

const ORDER_STATES = new Set<OrderLifecycleState>([
  "Submitted",
  "Planning",
  "Dispatchable",
  "Dispatched",
  "Applied",
  "Executing",
  "Replanning",
  "Held",
  "Cancelling",
  "Completed",
  "Cancelled",
  "Rejected",
]);

function applyOrder(
  snapshot: AuthoritativeSnapshot,
  event: StreamEnvelope,
  operation: OperationsEventPayload,
): AuthoritativeSnapshot {
  const data = operation.data;
  const existing = snapshot.orders.find(
    (order) => order.id === operation.entityId,
  );
  const rawState = String(data.state || existing?.state || "Submitted");
  const state = ORDER_STATES.has(rawState as OrderLifecycleState)
    ? (rawState as OrderLifecycleState)
    : existing?.state || "Submitted";
  const assignments = Array.isArray(data.assignments)
    ? data.assignments.map((value: any) => ({
        robotId: String(value.robotId || ""),
        goalColumn: Number(value.goalColumn) || 0,
        goalRow: Number(value.goalRow) || 0,
        arrivalAction: adaptArrivalAction(value.arrivalAction),
      }))
    : existing?.assignments || [];
  const map = data.map as Record<string, unknown> | undefined;

  const orderUpdateId =
    typeof data.orderUpdateId === "number"
      ? data.orderUpdateId
      : existing?.orderUpdateId || 0;

  const submittedAtUtc =
    typeof data.submittedAt === "string"
      ? data.submittedAt
      : existing?.submittedAtUtc ||
        (state === "Submitted" ? event.occurredAt : undefined);
  const updatedAtUtc =
    typeof data.updatedAt === "string" ? data.updatedAt : event.occurredAt;

  // Build / update timeline
  const prevTimeline: OrderTimelineEntry[] = existing?.timeline || [
    {
      id: `tl-${operation.entityId}-0`,
      state: "Submitted",
      occurredAtUtc: submittedAtUtc || event.occurredAt,
      orderUpdateId: 0,
      actor: "Operator",
      detail: "Order submitted",
    },
  ];

  let nextTimeline = [...prevTimeline];
  const lastEntry = nextTimeline[nextTimeline.length - 1];

  if (
    !lastEntry ||
    lastEntry.state !== state ||
    lastEntry.orderUpdateId !== orderUpdateId
  ) {
    const isAppAck = state === "Applied";
    const isExecReport = state === "Executing";
    const actor: OrderTimelineEntry["actor"] =
      isAppAck || isExecReport
        ? "Simulator"
        : state === "Submitted"
          ? "Operator"
          : "Core MAPF";

    const detail =
      typeof data.reason === "string" && data.reason
        ? data.reason
        : isAppAck
          ? "Simulator acknowledged order command (Application Ack)"
          : isExecReport
            ? "Simulator runtime reported executing state"
            : `Order transitioned to ${state}`;

    nextTimeline.push({
      id: `tl-${operation.entityId}-${orderUpdateId}-${state}-${Date.now()}`,
      state,
      occurredAtUtc: updatedAtUtc,
      orderUpdateId,
      planRevisionId:
        typeof data.planRevisionId === "string"
          ? data.planRevisionId
          : existing?.planRevisionId,
      actor,
      detail,
      isApplicationAck: isAppAck,
      isExecutionReport: isExecReport,
    });
  }

  const order: Order = {
    id: operation.entityId,
    entityVersion: operation.entityVersion,
    contentDigestSha256: operation.contentDigestSha256,
    orderUpdateId,
    plannedRoute: adaptPlannedRoute(
      data.plannedRoute,
      operation.entityId,
      orderUpdateId,
    ),
    planRevisionId:
      typeof data.planRevisionId === "string" ? data.planRevisionId : undefined,
    state,
    requestId:
      typeof data.requestId === "string" ? data.requestId : existing?.requestId,
    assignments,
    mapId:
      typeof data.mapId === "string"
        ? data.mapId
        : typeof map?.mapId === "string"
          ? map.mapId
          : existing?.mapId,
    mapRevision:
      typeof data.mapRevision === "number"
        ? data.mapRevision
        : typeof map?.revision === "number"
          ? map.revision
          : existing?.mapRevision,
    submittedAtUtc,
    updatedAtUtc,
    timeline: nextTimeline,
  };
  return {
    ...snapshot,
    orders: existing
      ? snapshot.orders.map((value) => (value.id === order.id ? order : value))
      : [...snapshot.orders, order],
  };
}

function applyConnectivity(
  snapshot: AuthoritativeSnapshot,
  operation: OperationsEventPayload,
): AuthoritativeSnapshot {
  const state = String(operation.data.state || "NotReady");
  const connectivity: ConnectivityState =
    state === "Synchronized"
      ? "CONNECTED"
      : state === "Degraded"
        ? "DISCONNECTED"
        : "DEGRADED";
  const freshness: FreshnessState =
    connectivity === "CONNECTED" ? "CURRENT" : "STALE";
  const robots = snapshot.robots.map((robot) =>
    robot.simulatorId === operation.entityId
      ? {
          ...robot,
          sessionEpoch:
            typeof operation.data.sessionEpoch === "number"
              ? operation.data.sessionEpoch
              : robot.sessionEpoch,
          connectivity,
          freshness,
          operationalState:
            connectivity === "DISCONNECTED"
              ? "STOPPED"
              : robot.operationalState,
        }
      : robot,
  );
  return {
    ...snapshot,
    robots,
    freshness:
      connectivity === "DISCONNECTED" ? "DISCONNECTED" : snapshot.freshness,
  };
}

function applyIncident(
  snapshot: AuthoritativeSnapshot,
  event: StreamEnvelope,
  operation: OperationsEventPayload,
): AuthoritativeSnapshot {
  const data = operation.data;
  const incidentId = operation.entityId;

  const severity: IncidentSeverity = (
    ["INFO", "WARNING", "CRITICAL"].includes(
      String(data.severity).toUpperCase(),
    )
      ? String(data.severity).toUpperCase()
      : "WARNING"
  ) as IncidentSeverity;

  const category: IncidentCategory = (
    [
      "safety",
      "collision_risk",
      "deadlock",
      "fault",
      "connectivity",
      "contract",
      "auth",
      "policy",
    ].includes(String(data.category).toLowerCase())
      ? String(data.category).toLowerCase()
      : "safety"
  ) as IncidentCategory;

  const status: IncidentStatus = (
    ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"].includes(
      String(data.status).toUpperCase(),
    )
      ? String(data.status).toUpperCase()
      : "ACTIVE"
  ) as IncidentStatus;

  const robotId =
    typeof data.robotId === "string"
      ? data.robotId
      : typeof data.relatedEntity === "object" &&
          (data.relatedEntity as any)?.type === "ROBOT"
        ? String((data.relatedEntity as any).id)
        : undefined;

  const code = String(data.code || data.reasonCode || "");
  const description = String(
    data.description || data.message || "Operational incident recorded",
  );

  const existingIncident = snapshot.incidents?.find(
    (inc) => inc.id === incidentId,
  );

  const incident: Incident = {
    id: incidentId,
    entityVersion: operation.entityVersion,
    contentDigestSha256: operation.contentDigestSha256,
    severity,
    category,
    status,
    occurredAtUtc:
      typeof data.occurredAt === "string" ? data.occurredAt : event.occurredAt,
    simulationTimeMs:
      typeof data.simulationTimeMs === "number" ? data.simulationTimeMs : 0,
    resolvedAtUtc:
      typeof data.resolvedAt === "string" ? data.resolvedAt : undefined,
    acknowledgedAtUtc:
      typeof data.acknowledgedAt === "string" ? data.acknowledgedAt : undefined,
    acknowledgedBy:
      typeof data.acknowledgedBy === "string" ? data.acknowledgedBy : undefined,
    reasonCode: code || existingIncident?.reasonCode || "INCIDENT",
    description:
      description || existingIncident?.description || "Incident recorded",
    relatedEntity: robotId
      ? { type: "ROBOT", id: robotId }
      : data.relatedEntity && typeof data.relatedEntity === "object"
        ? {
            type: (data.relatedEntity as any).type || "ROBOT",
            id: String((data.relatedEntity as any).id || ""),
            version: (data.relatedEntity as any).version,
          }
        : undefined,
    allowedActions: Array.isArray(data.allowedActions)
      ? data.allowedActions.map(String)
      : ["ACKNOWLEDGE"],
  };

  const incidents = snapshot.incidents || [];
  const nextIncidents = existingIncident
    ? incidents.map((inc) => (inc.id === incident.id ? incident : inc))
    : [...incidents, incident];

  // Also update robot safety state if this is an active safety incident
  let nextRobots = snapshot.robots;
  if (robotId && code !== "ORDER_COMPLETED") {
    nextRobots = snapshot.robots.map((robot) => {
      if (robot.id !== robotId) return robot;
      let safety = robot.safety;
      if (status === "RESOLVED") {
        safety = "NORMAL";
      } else if (code.includes("EMERGENCY")) {
        safety = "EMERGENCY_STOP";
      } else if (code.includes("FAULT")) {
        safety = "FAULT";
      } else if (code.includes("REJECT")) {
        safety = "REJECT";
      } else if (
        code.includes("STOP") ||
        code.includes("COLLISION") ||
        code.includes("DEADLOCK")
      ) {
        safety = "CONTROLLED_STOP";
      }
      return {
        ...robot,
        safety,
        operationalState:
          safety === "NORMAL" ? robot.operationalState : "STOPPED",
        occurredAtUtc: event.occurredAt,
      };
    });
  }

  return {
    ...snapshot,
    robots: nextRobots,
    incidents: nextIncidents,
  };
}

function entityKey(operation: OperationsEventPayload): string {
  return `${operation.entityType}:${operation.entityId}`;
}

function advanceCursor(
  snapshot: AuthoritativeSnapshot,
  eventSequence: number,
): AuthoritativeSnapshot {
  return {
    ...snapshot,
    cursor: { ...snapshot.cursor, eventSequence },
    freshness:
      snapshot.freshness === "RECONCILING" ? "CURRENT" : snapshot.freshness,
  };
}

export function coalesceStreamBatch(events: StreamEnvelope[]): {
  coalescedEvents: StreamEnvelope[];
  coalescedCount: number;
} {
  const latestRobotIndex = new Map<string, number>();
  const retained = new Set<number>();
  let coalescedCount = 0;
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    const payload = event.payload as Record<string, unknown>;
    if (
      event.messageType === "operations.event" &&
      payload.entityType === "ROBOT"
    ) {
      const robotId = String(payload.entityId || "");
      if (robotId && latestRobotIndex.has(robotId)) {
        coalescedCount++;
      } else {
        if (robotId) latestRobotIndex.set(robotId, index);
        retained.add(index);
      }
    } else {
      retained.add(index);
    }
  }
  return {
    coalescedEvents: events.filter((_, index) => retained.has(index)),
    coalescedCount,
  };
}

function recordDecision(
  diagnostics: ReconciliationDiagnostics,
  result: ApplyResult,
  eventCount = 1,
): ReconciliationDiagnostics {
  const decision = result.decision;
  return {
    ...diagnostics,
    totalEventsProcessed: diagnostics.totalEventsProcessed + eventCount,
    lastReconciledAt: new Date().toISOString(),
    lastDecision: decision,
    duplicateCount:
      diagnostics.duplicateCount + (decision === "DUPLICATE" ? 1 : 0),
    staleCount: diagnostics.staleCount + (decision === "STALE" ? 1 : 0),
    conflictCount:
      diagnostics.conflictCount + (decision === "CONFLICT" ? 1 : 0),
    gapCount: diagnostics.gapCount + (decision === "GAP" ? 1 : 0),
    lastConflictReason: result.conflictReason,
    lastGapDetails: result.gapDetails,
  };
}

function stateForSnapshot(
  snapshot: AuthoritativeSnapshot | null,
): ConnectionState {
  if (!snapshot) return "LoadingSnapshot";
  if (snapshot.freshness === "CURRENT") return "Current";
  if (snapshot.freshness === "STALE") return "Stale";
  if (snapshot.freshness === "PARTIAL") return "Partial";
  if (snapshot.freshness === "DISCONNECTED") return "Disconnected";
  return "Reconciling";
}

export function reconciliationReducer(
  state: ReconciliationState,
  action: ReconciliationAction,
): ReconciliationState {
  if (action.type === "TELEMETRY_STALE") {
    return { ...state, telemetryStale: true };
  }
  if (action.type === "TELEMETRY_RECEIVED") {
    if (!state.snapshot) return state;
    const data = action.data;
    const existing = state.snapshot.robots.find(
      (robot) => robot.id === action.robotId,
    );
    const epoch = Number(data.sessionEpoch);
    const version = Number(data.stateVersion);
    if (!Number.isSafeInteger(epoch) || !Number.isSafeInteger(version))
      return state;
    if (
      existing &&
      (epoch < (existing.sessionEpoch ?? 0) ||
        (epoch === existing.sessionEpoch &&
          existing.simulatorBootId !== undefined &&
          data.simulatorBootId !== existing.simulatorBootId) ||
        (epoch === (existing.sessionEpoch ?? 0) &&
          version <= (existing.stateVersion ?? 0)))
    )
      return state;
    const operation: OperationsEventPayload = {
      entityType: "ROBOT",
      entityId: action.robotId,
      entityVersion: version,
      contentDigestSha256: "",
      data,
    };
    const event: StreamEnvelope = {
      contractVersion: "1.0.0",
      messageType: "operations.event",
      messageId: "telemetry",
      producer: { kind: "CORE", id: "core" },
      occurredAt: String(data.observedAt),
      correlationId: "",
      eventSequence: 0,
      payload: { ...operation },
    };
    const snapshot = applyRobot(state.snapshot, event, operation);
    return {
      ...state,
      telemetryStale: false,
      snapshot,
    };
  }
  if (action.type === "SNAPSHOT_REPLACED") {
    let snapshot = action.snapshot;
    let sequence = snapshot.cursor.eventSequence;
    let diagnostics = state.diagnostics;

    // Ensure incidents is initialized
    if (!snapshot.incidents) {
      snapshot = { ...snapshot, incidents: [] };
    }

    if (action.bufferedEvents?.length) {
      for (const event of action.bufferedEvents) {
        if (event.eventSequence <= sequence) continue;
        const result = applySingleEvent(snapshot, event, sequence);
        snapshot = result.nextSnapshot || snapshot;
        sequence = result.nextSequence;
        diagnostics = recordDecision(diagnostics, result, 1);
        if (result.decision === "GAP" || result.decision === "CONFLICT") break;
      }
    }
    return {
      ...state,
      snapshot,
      connectionState: stateForSnapshot(snapshot),
      cursor: {
        streamId: snapshot.cursor.streamId,
        eventSequence: sequence,
      },
      diagnostics: {
        ...diagnostics,
        lastReconciledAt: new Date().toISOString(),
      },
    };
  }

  if (action.type === "SNAPSHOT_LOAD_FAILED") {
    return {
      ...state,
      snapshot: null,
      connectionState: "Failed",
    };
  }

  if (action.type === "STREAM_EVENT_RECEIVED") {
    const result = applySingleEvent(
      state.snapshot,
      action.event,
      state.cursor.eventSequence,
    );
    const snapshot = result.nextSnapshot;
    return {
      ...state,
      snapshot,
      connectionState:
        result.decision === "GAP" || result.decision === "CONFLICT"
          ? "Reconciling"
          : stateForSnapshot(snapshot),
      cursor: {
        streamId: snapshot?.cursor.streamId || state.cursor.streamId,
        eventSequence: result.nextSequence,
      },
      diagnostics: recordDecision(state.diagnostics, result, 1),
    };
  }

  if (action.type === "STREAM_BATCH_RECEIVED") {
    const events = action.events;
    if (!events.length) return state;
    let snapshot = state.snapshot;
    let sequence = state.cursor.eventSequence;
    let diagnostics = state.diagnostics;
    let lastResult: ApplyResult = {
      nextSnapshot: snapshot,
      decision: "APPLIED",
      nextSequence: sequence,
    };
    for (const event of events) {
      lastResult = applySingleEvent(snapshot, event, sequence);
      snapshot = lastResult.nextSnapshot;
      sequence = lastResult.nextSequence;
      diagnostics = recordDecision(diagnostics, lastResult, 1);
      if (lastResult.decision === "GAP" || lastResult.decision === "CONFLICT")
        break;
    }
    const { coalescedCount } = coalesceStreamBatch(events);
    return {
      ...state,
      snapshot,
      connectionState:
        lastResult.decision === "GAP" || lastResult.decision === "CONFLICT"
          ? "Reconciling"
          : stateForSnapshot(snapshot),
      cursor: {
        streamId: snapshot?.cursor.streamId || state.cursor.streamId,
        eventSequence: sequence,
      },
      diagnostics: {
        ...diagnostics,
        coalescedCount: diagnostics.coalescedCount + coalescedCount,
      },
    };
  }

  if (action.type === "INCIDENT_ACKNOWLEDGED") {
    if (!state.snapshot) return state;
    const incidents = state.snapshot.incidents || [];
    const updatedIncidents = incidents.map((inc) =>
      inc.id === action.incidentId
        ? {
            ...inc,
            status: "ACKNOWLEDGED" as IncidentStatus,
            acknowledgedAtUtc: action.occurredAtUtc,
            acknowledgedBy: action.acknowledgedBy || "Operator",
          }
        : inc,
    );
    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        incidents: updatedIncidents,
      },
    };
  }

  if (action.type === "INCIDENT_RESOLVED") {
    if (!state.snapshot) return state;
    const incidents = state.snapshot.incidents || [];
    const targetIncident = incidents.find(
      (inc) => inc.id === action.incidentId,
    );
    const updatedIncidents = incidents.map((inc) =>
      inc.id === action.incidentId
        ? {
            ...inc,
            status: "RESOLVED" as IncidentStatus,
            resolvedAtUtc: action.occurredAtUtc,
          }
        : inc,
    );

    // If incident was related to a robot and resolved, restore robot's safety to NORMAL
    let updatedRobots = state.snapshot.robots;
    if (
      targetIncident?.relatedEntity?.type === "ROBOT" &&
      targetIncident.relatedEntity.id
    ) {
      const robotId = targetIncident.relatedEntity.id;
      updatedRobots = updatedRobots.map((r) =>
        r.id === robotId
          ? {
              ...r,
              safety: "NORMAL",
              operationalState:
                r.operationalState === "STOPPED" ? "IDLE" : r.operationalState,
            }
          : r,
      );
    }

    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        incidents: updatedIncidents,
        robots: updatedRobots,
      },
    };
  }

  if (action.type === "ORDER_CREATED_OPTIMISTIC") {
    if (!state.snapshot) return state;
    const existingOrders = state.snapshot.orders || [];
    const existing = existingOrders.find((o) => o.id === action.order.id);
    const orders = existing
      ? existingOrders.map((o) => (o.id === action.order.id ? action.order : o))
      : [action.order, ...existingOrders];
    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        orders,
      },
    };
  }

  if (action.type === "ORDER_CANCELLED_CONFIRMED") {
    if (!state.snapshot) return state;
    const orders = (state.snapshot.orders || []).map((o) => {
      if (o.id !== action.orderId) return o;
      const timeline = o.timeline || [];
      return {
        ...o,
        state: "Cancelled" as OrderLifecycleState,
        orderUpdateId: action.orderUpdateId,
        updatedAtUtc: action.occurredAtUtc,
        timeline: [
          ...timeline,
          {
            id: `tl-${o.id}-${action.orderUpdateId}-Cancelled-${Date.now()}`,
            state: "Cancelled" as OrderLifecycleState,
            occurredAtUtc: action.occurredAtUtc,
            orderUpdateId: action.orderUpdateId,
            actor: "Operator" as const,
            detail: "Order cancelled by operator",
          },
        ],
      };
    });
    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        orders,
      },
    };
  }

  if (action.type === "ORDER_REASSIGNED_CONFIRMED") {
    if (!state.snapshot) return state;
    const orders = (state.snapshot.orders || []).map((o) => {
      if (o.id !== action.orderId) return o;
      const timeline = o.timeline || [];
      return {
        ...o,
        state: "Replanning" as OrderLifecycleState,
        orderUpdateId: action.orderUpdateId,
        assignments: action.assignments,
        updatedAtUtc: action.occurredAtUtc,
        timeline: [
          ...timeline,
          {
            id: `tl-${o.id}-${action.orderUpdateId}-Replanning-${Date.now()}`,
            state: "Replanning" as OrderLifecycleState,
            occurredAtUtc: action.occurredAtUtc,
            orderUpdateId: action.orderUpdateId,
            actor: "Operator" as const,
            detail: "Order goal / robot reassigned by operator",
          },
        ],
      };
    });
    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        orders,
      },
    };
  }

  if (action.type === "ROBOT_INSTANT_ACTION_APPLIED") {
    if (!state.snapshot) return state;
    const robots = state.snapshot.robots.map((r) => {
      if (r.id !== action.robotId) return r;
      let safety = r.safety;
      let operationalState = r.operationalState;
      if (action.action === "ESTOP") {
        safety = "EMERGENCY_STOP";
        operationalState = "STOPPED";
      } else if (action.action === "CLEAR_ESTOP") {
        safety = "NORMAL";
        operationalState = "IDLE";
      } else if (action.action === "PAUSE") {
        operationalState = "HELD";
      } else if (action.action === "RESUME") {
        operationalState = "EXECUTING";
      }
      return {
        ...r,
        safety,
        operationalState,
        occurredAtUtc: action.occurredAtUtc,
      };
    });
    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        robots,
      },
    };
  }

  if (action.type === "CONNECTION_STATE_CHANGED") {
    return {
      ...state,
      connectionState: action.connectionState,
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            freshness:
              action.connectionState === "Disconnected"
                ? "DISCONNECTED"
                : action.connectionState === "Reconciling"
                  ? "RECONCILING"
                  : state.snapshot.freshness,
          }
        : null,
    };
  }
  if (action.type === "TRANSPORT_MODE_CHANGED") {
    return { ...state, transportMode: action.transportMode };
  }
  if (action.type === "GAP_RECONCILIATION_REQUESTED") {
    return {
      ...state,
      connectionState: "Reconciling",
      snapshot: state.snapshot
        ? { ...state.snapshot, freshness: "RECONCILING" }
        : null,
      diagnostics: {
        ...state.diagnostics,
        gapCount: state.diagnostics.gapCount + 1,
        lastDecision: "GAP",
        lastGapDetails: {
          expected: action.expected,
          received: action.received,
        },
      },
    };
  }
  return { ...state, diagnostics: INITIAL_DIAGNOSTICS };
}

/** Apply telemetry staleness for display without overwriting durable stream state. */
export function selectReconciliationView(
  state: ReconciliationState,
): ReconciliationState {
  if (!state.telemetryStale) return state;
  return {
    ...state,
    connectionState:
      state.connectionState === "Current" ? "Stale" : state.connectionState,
    snapshot: state.snapshot
      ? {
          ...state.snapshot,
          freshness:
            state.snapshot.freshness === "CURRENT"
              ? "STALE"
              : state.snapshot.freshness,
          robots: state.snapshot.robots.map((robot) => ({
            ...robot,
            freshness: "STALE",
          })),
        }
      : null,
  };
}
