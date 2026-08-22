/**
 * Pure state machine and stream reducer for MAPF-RL state reconciliation.
 */

import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";
import type {
  StreamEnvelope,
  ReconciliationState,
  ReconciliationDecision,
  ReconciliationDiagnostics,
  RobotStateReportPayload,
  RobotEventReportPayload,
  OperationsEventPayload,
  ConnectionState,
  StreamTransportMode,
} from "../../domain/event/types.ts";
import {
  adaptRobotStateReport,
  adaptOperationsEvent,
} from "../../contracts/adapters/eventAdapter.ts";

export type ReconciliationAction =
  | {
      type: "SNAPSHOT_REPLACED";
      snapshot: AuthoritativeSnapshot;
      bufferedEvents?: StreamEnvelope[];
    }
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
  cursor: {
    streamId: "operations",
    eventSequence: 0,
  },
  diagnostics: INITIAL_DIAGNOSTICS,
};

/**
 * Checks if two robot poses and basic attributes are strictly identical.
 */
function isRobotStateIdentical(
  robot: Robot,
  payload: RobotStateReportPayload,
): boolean {
  return (
    robot.pose.xMeters === payload.pose.xMeters &&
    robot.pose.yMeters === payload.pose.yMeters &&
    robot.pose.yawRadians === payload.pose.yawRadians &&
    robot.operationalState === payload.operationalState &&
    robot.connectivity === payload.connectivity &&
    robot.safety === payload.safety &&
    robot.activeController.mode === payload.activeController.mode &&
    robot.activeController.identity === payload.activeController.identity &&
    (payload.batteryPercent === undefined ||
      robot.batteryPercent === payload.batteryPercent)
  );
}

/**
 * Applies a single stream event to the current snapshot.
 * Returns the updated snapshot, the decision taken, and any conflict reason.
 */
export function applySingleEvent(
  snapshot: AuthoritativeSnapshot | null,
  event: StreamEnvelope,
  currentSequence: number,
): {
  nextSnapshot: AuthoritativeSnapshot | null;
  decision: ReconciliationDecision;
  nextSequence: number;
  conflictReason?: string;
  gapDetails?: { expected: number; received: number };
} {
  if (!snapshot) {
    return {
      nextSnapshot: null,
      decision: "STALE",
      nextSequence: currentSequence,
    };
  }

  const seq = event.eventSequence;

  // 1. GAP CHECK: If sequence is greater than next expected sequence
  if (seq > currentSequence + 1) {
    return {
      nextSnapshot: {
        ...snapshot,
        freshness: "RECONCILING",
      },
      decision: "GAP",
      nextSequence: currentSequence,
      gapDetails: {
        expected: currentSequence + 1,
        received: seq,
      },
    };
  }

  // 2. STALE / DUPLICATE CHECK: If sequence is less than or equal to currentSequence
  if (seq <= currentSequence) {
    // Check specific payload entities for duplicate vs stale vs conflict
    if (event.messageType === "robot.state.report") {
      const payload = adaptRobotStateReport(
        event.payload as Record<string, unknown>,
      );
      const existingRobot = snapshot.robots.find(
        (r) => r.id === payload.robotId,
      );

      if (existingRobot) {
        if (payload.stateVersion < existingRobot.stateVersion) {
          return {
            nextSnapshot: snapshot,
            decision: "STALE",
            nextSequence: currentSequence,
          };
        }

        if (payload.stateVersion === existingRobot.stateVersion) {
          if (isRobotStateIdentical(existingRobot, payload)) {
            return {
              nextSnapshot: snapshot,
              decision: "DUPLICATE",
              nextSequence: currentSequence,
            };
          } else {
            // Same stateVersion with differing content -> Conflict!
            return {
              nextSnapshot: {
                ...snapshot,
                freshness: "RECONCILING",
              },
              decision: "CONFLICT",
              nextSequence: currentSequence,
              conflictReason: `Conflicting robot state for ${payload.robotId} at version ${payload.stateVersion}`,
            };
          }
        }
      }
    } else if (event.messageType === "operations.event") {
      const payload = adaptOperationsEvent(
        event.payload as Record<string, unknown>,
      );
      if (payload.entityType === "ORDER") {
        const existingOrder = snapshot.orders.find(
          (o) => o.id === payload.entityId,
        );
        if (existingOrder && payload.orderUpdateId !== undefined) {
          if (payload.orderUpdateId < existingOrder.orderUpdateId) {
            return {
              nextSnapshot: snapshot,
              decision: "STALE",
              nextSequence: currentSequence,
            };
          }
          if (payload.orderUpdateId === existingOrder.orderUpdateId) {
            if (
              payload.state === undefined ||
              payload.state === existingOrder.state
            ) {
              return {
                nextSnapshot: snapshot,
                decision: "DUPLICATE",
                nextSequence: currentSequence,
              };
            } else {
              return {
                nextSnapshot: {
                  ...snapshot,
                  freshness: "RECONCILING",
                },
                decision: "CONFLICT",
                nextSequence: currentSequence,
                conflictReason: `Conflicting order state for ${payload.entityId} at updateId ${payload.orderUpdateId}`,
              };
            }
          }
        }
      }
    }

    // Default duplicate for matching/older sequence
    return {
      nextSnapshot: snapshot,
      decision: "DUPLICATE",
      nextSequence: currentSequence,
    };
  }

  // 3. APPLIED: Strictly consecutive sequence (seq === currentSequence + 1)
  let updatedRobots = snapshot.robots;
  let updatedOrders = snapshot.orders;

  if (event.messageType === "robot.state.report") {
    const payload = adaptRobotStateReport(
      event.payload as Record<string, unknown>,
    );
    const existingIndex = snapshot.robots.findIndex(
      (r) => r.id === payload.robotId,
    );

    const newRobot: Robot = {
      id: payload.robotId,
      stateVersion: payload.stateVersion,
      simulationTimeMs: payload.simulationTimeMs,
      occurredAtUtc: event.occurredAt,
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
      batteryPercent: payload.batteryPercent ?? 100,
    };

    if (existingIndex >= 0) {
      const existingRobot = snapshot.robots[existingIndex];
      // Check for conflict
      if (
        payload.stateVersion === existingRobot.stateVersion &&
        !isRobotStateIdentical(existingRobot, payload)
      ) {
        return {
          nextSnapshot: {
            ...snapshot,
            freshness: "RECONCILING",
          },
          decision: "CONFLICT",
          nextSequence: currentSequence,
          conflictReason: `Conflicting robot state for ${payload.robotId} at version ${payload.stateVersion}`,
        };
      }

      updatedRobots = [...snapshot.robots];
      updatedRobots[existingIndex] = newRobot;
    } else {
      updatedRobots = [...snapshot.robots, newRobot];
    }
  } else if (event.messageType === "robot.event.report") {
    const payload = event.payload as unknown as RobotEventReportPayload;
    const existingIndex = snapshot.robots.findIndex(
      (r) => r.id === payload.robotId,
    );

    if (existingIndex >= 0) {
      const robot = snapshot.robots[existingIndex];
      let newSafety = robot.safety;
      let newOperational = robot.operationalState;

      if (
        payload.eventType === "SAFETY_STOP" ||
        payload.eventType === "EMERGENCY_STOP"
      ) {
        newSafety =
          payload.eventType === "EMERGENCY_STOP"
            ? "EMERGENCY_STOP"
            : "CONTROLLED_STOP";
        newOperational = "STOPPED";
      } else if (payload.eventType === "SAFETY_RESUME") {
        newSafety = "NORMAL";
        newOperational = "IDLE";
      }

      updatedRobots = [...snapshot.robots];
      updatedRobots[existingIndex] = {
        ...robot,
        safety: newSafety,
        operationalState: newOperational,
        occurredAtUtc: event.occurredAt,
      };
    }
  } else if (event.messageType === "operations.event") {
    const payload = adaptOperationsEvent(
      event.payload as Record<string, unknown>,
    );

    if (payload.entityType === "ORDER") {
      const existingIndex = snapshot.orders.findIndex(
        (o) => o.id === payload.entityId,
      );

      if (existingIndex >= 0) {
        const order = snapshot.orders[existingIndex];
        const nextOrderUpdateId =
          payload.orderUpdateId !== undefined
            ? payload.orderUpdateId
            : order.orderUpdateId + 1;

        const updatedOrder: Order = {
          ...order,
          state: payload.state || order.state,
          orderUpdateId: nextOrderUpdateId,
          planRevisionId: payload.planRevisionId || order.planRevisionId,
          assignments: payload.assignments || order.assignments,
          updatedAtUtc: payload.occurredAt || event.occurredAt,
        };

        updatedOrders = [...snapshot.orders];
        updatedOrders[existingIndex] = updatedOrder;
      } else if (payload.entityId) {
        const newOrder: Order = {
          id: payload.entityId,
          orderUpdateId: payload.orderUpdateId ?? 0,
          planRevisionId: payload.planRevisionId,
          state: payload.state || "Submitted",
          assignments: payload.assignments || [],
          submittedAtUtc: payload.occurredAt || event.occurredAt,
          updatedAtUtc: payload.occurredAt || event.occurredAt,
        };
        updatedOrders = [...snapshot.orders, newOrder];
      }
    }
  }

  const nextSnapshot: AuthoritativeSnapshot = {
    ...snapshot,
    cursor: {
      streamId: snapshot.cursor.streamId,
      eventSequence: seq,
    },
    freshness: "CURRENT",
    robots: updatedRobots,
    orders: updatedOrders,
  };

  return {
    nextSnapshot,
    decision: "APPLIED",
    nextSequence: seq,
  };
}

/**
 * Coalesces multiple robot state reports in a batch so that only the latest version per robot is processed.
 */
export function coalesceStreamBatch(events: StreamEnvelope[]): {
  coalescedEvents: StreamEnvelope[];
  coalescedCount: number;
} {
  const robotLatestIndexMap = new Map<string, number>();
  const finalIndices = new Set<number>();
  let coalescedCount = 0;

  // Process backwards to find latest state report for each robot
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.messageType === "robot.state.report") {
      const robotId = String((ev.payload as any)?.robotId || "");
      if (robotId) {
        if (!robotLatestIndexMap.has(robotId)) {
          robotLatestIndexMap.set(robotId, i);
          finalIndices.add(i);
        } else {
          coalescedCount++;
        }
      } else {
        finalIndices.add(i);
      }
    } else {
      // Non-replaceable events (orders, events, acks) are never dropped
      finalIndices.add(i);
    }
  }

  const coalescedEvents = events.filter((_, idx) => finalIndices.has(idx));
  return { coalescedEvents, coalescedCount };
}

/**
 * Pure reducer function for MAPF-RL state reconciliation.
 */
export function reconciliationReducer(
  state: ReconciliationState,
  action: ReconciliationAction,
): ReconciliationState {
  switch (action.type) {
    case "SNAPSHOT_REPLACED": {
      const newSnapshot = action.snapshot;
      let currentSeq = newSnapshot.cursor.eventSequence;
      let workingSnapshot: AuthoritativeSnapshot | null = newSnapshot;
      let duplicateCount = state.diagnostics.duplicateCount;
      let staleCount = state.diagnostics.staleCount;
      let conflictCount = state.diagnostics.conflictCount;
      let gapCount = state.diagnostics.gapCount;
      let totalProcessed = state.diagnostics.totalEventsProcessed;

      // If there are buffered events that arrived during snapshot load, replay them
      if (action.bufferedEvents && action.bufferedEvents.length > 0) {
        const replayEvents = action.bufferedEvents.filter(
          (e) => e.eventSequence > currentSeq,
        );

        for (const ev of replayEvents) {
          totalProcessed++;
          const result = applySingleEvent(workingSnapshot, ev, currentSeq);
          workingSnapshot = result.nextSnapshot;
          currentSeq = result.nextSequence;

          if (result.decision === "DUPLICATE") duplicateCount++;
          else if (result.decision === "STALE") staleCount++;
          else if (result.decision === "CONFLICT") conflictCount++;
          else if (result.decision === "GAP") {
            gapCount++;
            break;
          }
        }
      }

      return {
        ...state,
        snapshot: workingSnapshot,
        connectionState:
          workingSnapshot?.freshness === "RECONCILING"
            ? "Reconciling"
            : workingSnapshot?.freshness === "CURRENT"
              ? "Current"
              : state.connectionState,
        cursor: {
          streamId: workingSnapshot?.cursor.streamId || state.cursor.streamId,
          eventSequence: currentSeq,
        },
        diagnostics: {
          ...state.diagnostics,
          duplicateCount,
          staleCount,
          conflictCount,
          gapCount,
          totalEventsProcessed: totalProcessed,
          lastReconciledAt: new Date().toISOString(),
          lastDecision: "APPLIED",
        },
      };
    }

    case "STREAM_EVENT_RECEIVED": {
      const event = action.event;
      const currentSeq = state.cursor.eventSequence;
      const result = applySingleEvent(state.snapshot, event, currentSeq);

      let { duplicateCount, staleCount, conflictCount, gapCount } =
        state.diagnostics;

      if (result.decision === "DUPLICATE") duplicateCount++;
      else if (result.decision === "STALE") staleCount++;
      else if (result.decision === "CONFLICT") conflictCount++;
      else if (result.decision === "GAP") gapCount++;

      const nextConnectionState: ConnectionState =
        result.decision === "GAP" || result.decision === "CONFLICT"
          ? "Reconciling"
          : result.decision === "APPLIED"
            ? "Current"
            : state.connectionState;

      return {
        ...state,
        snapshot: result.nextSnapshot,
        connectionState: nextConnectionState,
        cursor: {
          streamId:
            result.nextSnapshot?.cursor.streamId || state.cursor.streamId,
          eventSequence: result.nextSequence,
        },
        diagnostics: {
          ...state.diagnostics,
          duplicateCount,
          staleCount,
          conflictCount,
          gapCount,
          totalEventsProcessed: state.diagnostics.totalEventsProcessed + 1,
          lastReconciledAt: new Date().toISOString(),
          lastDecision: result.decision,
          lastConflictReason: result.conflictReason,
          lastGapDetails: result.gapDetails,
        },
      };
    }

    case "STREAM_BATCH_RECEIVED": {
      const rawEvents = [...action.events].sort(
        (a, b) => a.eventSequence - b.eventSequence,
      );
      if (rawEvents.length === 0) return state;

      let workingSnapshot = state.snapshot;
      let currentSeq = state.cursor.eventSequence;
      let duplicateCount = state.diagnostics.duplicateCount;
      let staleCount = state.diagnostics.staleCount;
      let conflictCount = state.diagnostics.conflictCount;
      let gapCount = state.diagnostics.gapCount;
      let coalescedCount = 0;
      let lastDecision: ReconciliationDecision = "APPLIED";
      let lastConflictReason: string | undefined;
      let lastGapDetails: { expected: number; received: number } | undefined;

      // Check initial gap in batch
      if (rawEvents[0].eventSequence > currentSeq + 1) {
        return {
          ...state,
          connectionState: "Reconciling",
          snapshot: workingSnapshot
            ? { ...workingSnapshot, freshness: "RECONCILING" }
            : null,
          diagnostics: {
            ...state.diagnostics,
            gapCount: state.diagnostics.gapCount + 1,
            totalEventsProcessed:
              state.diagnostics.totalEventsProcessed + rawEvents.length,
            lastDecision: "GAP",
            lastGapDetails: {
              expected: currentSeq + 1,
              received: rawEvents[0].eventSequence,
            },
          },
        };
      }

      // Filter out stale/duplicate events with eventSequence <= currentSeq
      const newEvents: StreamEnvelope[] = [];
      for (const ev of rawEvents) {
        if (ev.eventSequence <= currentSeq) {
          duplicateCount++;
        } else {
          newEvents.push(ev);
        }
      }

      if (newEvents.length === 0) {
        return {
          ...state,
          diagnostics: {
            ...state.diagnostics,
            duplicateCount,
            totalEventsProcessed:
              state.diagnostics.totalEventsProcessed + rawEvents.length,
            lastDecision: "DUPLICATE",
          },
        };
      }

      // Check for internal gap in newEvents
      const contiguousEvents: StreamEnvelope[] = [];
      let expectedSeq = currentSeq + 1;

      for (const ev of newEvents) {
        if (ev.eventSequence === expectedSeq) {
          contiguousEvents.push(ev);
          expectedSeq++;
        } else if (ev.eventSequence === expectedSeq - 1) {
          // Exact same sequence within batch (duplicate in batch)
          contiguousEvents.push(ev);
        } else if (ev.eventSequence > expectedSeq) {
          // Internal gap found
          gapCount++;
          lastGapDetails = {
            expected: expectedSeq,
            received: ev.eventSequence,
          };
          break;
        }
      }

      const { coalescedEvents, coalescedCount: batchCoalesced } =
        coalesceStreamBatch(contiguousEvents);
      coalescedCount += batchCoalesced;

      // Apply each coalesced event
      for (const ev of coalescedEvents) {
        if (ev.messageType === "robot.state.report" && workingSnapshot) {
          const payload = adaptRobotStateReport(
            ev.payload as Record<string, unknown>,
          );
          const existingIndex = workingSnapshot.robots.findIndex(
            (r) => r.id === payload.robotId,
          );

          if (existingIndex >= 0) {
            const existingRobot = workingSnapshot.robots[existingIndex];
            if (
              payload.stateVersion === existingRobot.stateVersion &&
              !isRobotStateIdentical(existingRobot, payload)
            ) {
              conflictCount++;
              lastConflictReason = `Conflicting robot state for ${payload.robotId} at version ${payload.stateVersion}`;
              lastDecision = "CONFLICT";
              continue;
            }
          }

          const newRobot: Robot = {
            id: payload.robotId,
            stateVersion: payload.stateVersion,
            simulationTimeMs: payload.simulationTimeMs,
            occurredAtUtc: ev.occurredAt,
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
            batteryPercent: payload.batteryPercent ?? 100,
          };

          const updatedRobots = [...workingSnapshot.robots];
          if (existingIndex >= 0) {
            updatedRobots[existingIndex] = newRobot;
          } else {
            updatedRobots.push(newRobot);
          }

          workingSnapshot = {
            ...workingSnapshot,
            robots: updatedRobots,
          };
        } else if (ev.messageType === "operations.event" && workingSnapshot) {
          const payload = adaptOperationsEvent(
            ev.payload as Record<string, unknown>,
          );
          if (payload.entityType === "ORDER") {
            const existingIndex = workingSnapshot.orders.findIndex(
              (o) => o.id === payload.entityId,
            );
            if (existingIndex >= 0) {
              const order = workingSnapshot.orders[existingIndex];
              const updatedOrder: Order = {
                ...order,
                state: payload.state || order.state,
                orderUpdateId:
                  payload.orderUpdateId !== undefined
                    ? payload.orderUpdateId
                    : order.orderUpdateId + 1,
                planRevisionId: payload.planRevisionId || order.planRevisionId,
                assignments: payload.assignments || order.assignments,
                updatedAtUtc: payload.occurredAt || ev.occurredAt,
              };
              const updatedOrders = [...workingSnapshot.orders];
              updatedOrders[existingIndex] = updatedOrder;
              workingSnapshot = {
                ...workingSnapshot,
                orders: updatedOrders,
              };
            }
          }
        }
      }

      const maxContiguousSeq =
        contiguousEvents.length > 0
          ? contiguousEvents[contiguousEvents.length - 1].eventSequence
          : currentSeq;

      if (workingSnapshot) {
        workingSnapshot = {
          ...workingSnapshot,
          cursor: {
            streamId: workingSnapshot.cursor.streamId,
            eventSequence: maxContiguousSeq,
          },
          freshness:
            lastDecision === "CONFLICT" || lastGapDetails !== undefined
              ? "RECONCILING"
              : "CURRENT",
        };
      }

      const nextConnectionState: ConnectionState =
        lastDecision === "CONFLICT" || lastGapDetails !== undefined
          ? "Reconciling"
          : "Current";

      return {
        ...state,
        snapshot: workingSnapshot,
        connectionState: nextConnectionState,
        cursor: {
          streamId: workingSnapshot?.cursor.streamId || state.cursor.streamId,
          eventSequence: maxContiguousSeq,
        },
        diagnostics: {
          ...state.diagnostics,
          duplicateCount,
          staleCount,
          conflictCount,
          gapCount,
          coalescedCount: state.diagnostics.coalescedCount + coalescedCount,
          totalEventsProcessed:
            state.diagnostics.totalEventsProcessed + rawEvents.length,
          lastReconciledAt: new Date().toISOString(),
          lastDecision: lastGapDetails ? "GAP" : lastDecision,
          lastConflictReason,
          lastGapDetails,
        },
      };
    }

    case "CONNECTION_STATE_CHANGED":
      return {
        ...state,
        connectionState: action.connectionState,
      };

    case "TRANSPORT_MODE_CHANGED":
      return {
        ...state,
        transportMode: action.transportMode,
      };

    case "GAP_RECONCILIATION_REQUESTED":
      return {
        ...state,
        connectionState: "Reconciling",
        snapshot: state.snapshot
          ? { ...state.snapshot, freshness: "RECONCILING" }
          : null,
        diagnostics: {
          ...state.diagnostics,
          gapCount: state.diagnostics.gapCount + 1,
          lastGapDetails: {
            expected: action.expected,
            received: action.received,
          },
        },
      };

    case "RESET_DIAGNOSTICS":
      return {
        ...state,
        diagnostics: INITIAL_DIAGNOSTICS,
      };

    default:
      return state;
  }
}
