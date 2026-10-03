/**
 * Domain types for Operator Mutations, Intent Submission, and State Machine.
 */

import type { NormalizedProblem } from "../../contracts/adapters/problem.ts";

export type MutationOperation =
  | "CREATE_ORDER"
  | "CANCEL_ORDER"
  | "REASSIGN_ORDER"
  | "INSTANT_ACTION"
  | "ACKNOWLEDGE_INCIDENT"
  | "RESOLVE_INCIDENT";

export type MutationState =
  | "draft"
  | "submitting"
  | "confirmed"
  | "uncertain"
  | "rejected";

export interface CreateOrderAssignmentInput {
  robotId: string;
  goalColumn: number;
  goalRow: number;
  arrivalAction?: import("../../contracts/generated.ts").StationAction;
}

export interface CreateOrderRequest {
  requestId: string;
  mapId: string;
  mapRevision: number;
  assignments: CreateOrderAssignmentInput[];
}

export type CreateOrderInput =
  | Omit<CreateOrderRequest, "requestId">
  | Omit<
      import("../../contracts/auto-assignment.generated.ts").AutoAssignOrderRequest,
      "requestId"
    >;

export type CancelOrderRequest = Omit<
  import("../../contracts/generated.ts").CancelOrderCommand,
  "requestId"
> & { orderId: string };

export interface ReassignOrderRequest {
  orderId: string;
  orderUpdateId: number;
  assignments: CreateOrderAssignmentInput[];
  reason?: string;
}

export type InstantActionKind =
  | "PAUSE"
  | "RESUME"
  | "CANCEL"
  | "ESTOP"
  | "CLEAR_ESTOP";

export interface InstantActionRequest {
  robotId: string;
  action: InstantActionKind;
  reason?: string;
  sessionEpoch?: number;
}

export interface IncidentActionRequest {
  incidentId: string;
  action: "ACKNOWLEDGE" | "RESOLVE";
  operatorNote?: string;
}

export interface MutationOutcome {
  status: "ACCEPTED" | "REJECTED" | "CONFIRMED";
  entityId?: string;
  entityVersion?: number;
  orderUpdateId?: number;
  data?: unknown;
}

export interface PendingMutation<TPayload = Record<string, unknown>> {
  requestId: string; // RFC 4122 UUIDv4
  operation: MutationOperation;
  state: MutationState;
  payload: TPayload;
  payloadDigest: string; // Stable hash for duplicate prevention
  submittedAtUtc: string;
  attemptCount: number;
  targetEntityId?: string;
  targetEntityVersion?: number;
  error?: NormalizedProblem;
  outcome?: MutationOutcome;
}
