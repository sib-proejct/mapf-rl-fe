/**
 * Domain types for WebSocket stream events, connection lifecycle, and reconciliation.
 */

import type { AuthoritativeSnapshot, StreamCursor } from "../snapshot/types.ts";
import type {
  RobotPose,
  RobotOperationalState,
  ConnectivityState,
  SafetyState,
  ActiveController,
} from "../robot/types.ts";

export type ConnectionState =
  | "SignedOut"
  | "LoadingSnapshot"
  | "ConnectingStream"
  | "Reconciling"
  | "Current"
  | "Stale"
  | "Partial"
  | "Disconnected"
  | "Failed";

export type StreamTransportMode =
  | "FIXTURE_STREAM"
  | "LIVE_WEBSOCKET"
  | "POLLING_FALLBACK";

export type StreamMessageType =
  | "command.ack"
  | "operations.event"
  | "order.command"
  | "report.ack"
  | "robot.event.report"
  | "robot.state.report"
  | "stream.welcome";

export interface StreamProducer {
  kind: "CORE" | "SIMULATOR";
  id: string;
}

export interface StreamEnvelope<
  TPayload extends object = Record<string, unknown>,
> {
  contractVersion: "1.0.0";
  messageId: string;
  messageType: StreamMessageType;
  producer: StreamProducer;
  occurredAt: string;
  correlationId: string;
  eventSequence: number;
  payload: TPayload;
}

export interface StreamWelcomePayload {
  streamId: string;
  initialSequence: number;
  serverTimeUtc: string;
  heartbeatIntervalMs: number;
  replayWindowEvents: number;
}

export interface RobotStateReportPayload {
  robotId: string;
  stateVersion: number;
  simulationTimeMs: number;
  pose: RobotPose;
  operationalState: RobotOperationalState;
  connectivity: ConnectivityState;
  safety: SafetyState;
  activeController: ActiveController;
  batteryPercent?: number;
  stationActionsVersion?: string;
  stationState?: import("../../contracts/adapters/stationAdapter.ts").StationState;
  orderId?: string;
  orderUpdateId?: number;
  sessionEpoch?: number;
  simulatorId?: string;
  contentDigestSha256?: string;
}

export interface RobotEventReportPayload {
  robotId: string;
  eventSequence: number;
  eventType:
    | "SAFETY_STOP"
    | "SAFETY_RESUME"
    | "EMERGENCY_STOP"
    | "COLLISION_WARNING"
    | "FAULT"
    | "CONTROLLER_SWITCH";
  severity: "INFO" | "WARNING" | "CRITICAL";
  simulationTimeMs: number;
  reasonCode: string;
  description: string;
  relatedOrderId?: string;
}

export interface OperationsEventPayload {
  entityType:
    | "MAP"
    | "ROBOT"
    | "ORDER"
    | "INCIDENT"
    | "PLAN_REVISION"
    | "POLICY_DEPLOYMENT"
    | "CONNECTIVITY";
  entityId: string;
  entityVersion: number;
  contentDigestSha256: string;
  data: Record<string, unknown>;
}

export type ReconciliationDecision =
  | "APPLIED"
  | "DUPLICATE"
  | "STALE"
  | "CONFLICT"
  | "GAP"
  | "COALESCED";

export interface ReconciliationDiagnostics {
  duplicateCount: number;
  staleCount: number;
  conflictCount: number;
  gapCount: number;
  coalescedCount: number;
  totalEventsProcessed: number;
  lastReconciledAt: string | null;
  lastDecision: ReconciliationDecision | null;
  lastConflictReason?: string;
  lastGapDetails?: { expected: number; received: number };
}

export interface ReconciliationState {
  snapshot: AuthoritativeSnapshot | null;
  connectionState: ConnectionState;
  transportMode: StreamTransportMode;
  cursor: StreamCursor;
  diagnostics: ReconciliationDiagnostics;
}
