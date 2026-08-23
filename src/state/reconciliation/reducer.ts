/** Pure reconciliation state machine for the canonical Core operations stream. */

import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import type {
  ConnectivityState,
  FreshnessState,
  Robot,
} from "../../domain/robot/types.ts";
import type { Order, OrderLifecycleState } from "../../domain/order/types.ts";
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
import { adaptRasterMap } from "../../contracts/adapters/mapAdapter.ts";

export type ReconciliationAction =
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
  | { type: "RESET_DIAGNOSTICS" };

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
  transportMode: "FIXTURE_STREAM",
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
    sessionEpoch: payload.sessionEpoch,
    simulatorId: payload.simulatorId,
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
      }))
    : existing?.assignments || [];
  const map = data.map as Record<string, unknown> | undefined;
  const order: Order = {
    id: operation.entityId,
    entityVersion: operation.entityVersion,
    contentDigestSha256: operation.contentDigestSha256,
    orderUpdateId:
      typeof data.orderUpdateId === "number"
        ? data.orderUpdateId
        : existing?.orderUpdateId || 0,
    planRevisionId:
      typeof data.planRevisionId === "string"
        ? data.planRevisionId
        : existing?.planRevisionId,
    state,
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
    submittedAtUtc: existing?.submittedAtUtc || event.occurredAt,
    updatedAtUtc:
      typeof data.updatedAt === "string" ? data.updatedAt : event.occurredAt,
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
  const robotId =
    typeof operation.data.robotId === "string" ? operation.data.robotId : null;
  const code = String(operation.data.code || "");
  if (!robotId || code === "ORDER_COMPLETED") return snapshot;
  const robots = snapshot.robots.map((robot) => {
    if (robot.id !== robotId) return robot;
    let safety = robot.safety;
    if (code.includes("EMERGENCY")) safety = "EMERGENCY_STOP";
    else if (code.includes("FAULT")) safety = "FAULT";
    else if (code.includes("REJECT")) safety = "REJECT";
    else if (code.includes("STOP") || code.includes("COLLISION")) {
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
  return { ...snapshot, robots };
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
  processed: number,
): ReconciliationDiagnostics {
  return {
    ...diagnostics,
    duplicateCount:
      diagnostics.duplicateCount + (result.decision === "DUPLICATE" ? 1 : 0),
    staleCount: diagnostics.staleCount + (result.decision === "STALE" ? 1 : 0),
    conflictCount:
      diagnostics.conflictCount + (result.decision === "CONFLICT" ? 1 : 0),
    gapCount: diagnostics.gapCount + (result.decision === "GAP" ? 1 : 0),
    totalEventsProcessed: diagnostics.totalEventsProcessed + processed,
    lastReconciledAt: new Date().toISOString(),
    lastDecision: result.decision,
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
  if (snapshot.freshness === "RECONCILING") return "Reconciling";
  return "Disconnected";
}

export function reconciliationReducer(
  state: ReconciliationState,
  action: ReconciliationAction,
): ReconciliationState {
  if (action.type === "SNAPSHOT_REPLACED") {
    let snapshot: AuthoritativeSnapshot | null = action.snapshot;
    let sequence = action.snapshot.cursor.eventSequence;
    let diagnostics = state.diagnostics;
    const buffered = [...(action.bufferedEvents || [])]
      .filter((event) => event.eventSequence > sequence)
      .sort((left, right) => left.eventSequence - right.eventSequence);
    for (const event of buffered) {
      const result = applySingleEvent(snapshot, event, sequence);
      snapshot = result.nextSnapshot;
      sequence = result.nextSequence;
      diagnostics = recordDecision(diagnostics, result, 1);
      if (result.decision === "GAP" || result.decision === "CONFLICT") break;
    }
    return {
      ...state,
      snapshot,
      connectionState: stateForSnapshot(snapshot),
      cursor: {
        streamId: snapshot?.cursor.streamId || state.cursor.streamId,
        eventSequence: sequence,
      },
      diagnostics: {
        ...diagnostics,
        lastReconciledAt: new Date().toISOString(),
        lastDecision: buffered.length ? diagnostics.lastDecision : "APPLIED",
        lastConflictReason: undefined,
        lastGapDetails: undefined,
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
    return {
      ...state,
      snapshot: result.nextSnapshot,
      connectionState:
        result.decision === "GAP" || result.decision === "CONFLICT"
          ? "Reconciling"
          : stateForSnapshot(result.nextSnapshot),
      cursor: {
        streamId: result.nextSnapshot?.cursor.streamId || state.cursor.streamId,
        eventSequence: result.nextSequence,
      },
      diagnostics: recordDecision(state.diagnostics, result, 1),
    };
  }

  if (action.type === "STREAM_BATCH_RECEIVED") {
    const events = [...action.events].sort(
      (left, right) => left.eventSequence - right.eventSequence,
    );
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
