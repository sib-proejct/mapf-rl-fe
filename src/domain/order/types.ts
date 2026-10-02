/**
 * Typed domain models for Order state, lifecycle, assignments, and audit timeline.
 */

export type OrderLifecycleState =
  | "Submitted"
  | "Planning"
  | "Dispatchable"
  | "Dispatched"
  | "Applied"
  | "Executing"
  | "Replanning"
  | "Held"
  | "Cancelling"
  | "Completed"
  | "Cancelled"
  | "Rejected";

export interface OrderAssignment {
  robotId: string;
  goalColumn: number;
  goalRow: number;
  arrivalAction?: import("../../contracts/generated.ts").StationAction;
}

export interface OrderTimelineEntry {
  id: string;
  state: OrderLifecycleState;
  occurredAtUtc: string;
  orderUpdateId: number;
  planRevisionId?: string;
  actor?: "Operator" | "Core MAPF" | "Simulator";
  detail?: string;
  isApplicationAck?: boolean;
  isExecutionReport?: boolean;
}

export interface Order {
  requestId?: string;
  id: string;
  entityVersion: number;
  contentDigestSha256?: string;
  orderUpdateId: number;
  planRevisionId?: string;
  state: OrderLifecycleState;
  assignments: OrderAssignment[];
  mapId?: string;
  mapRevision?: number;
  submittedAtUtc?: string;
  updatedAtUtc?: string;
  timeline?: OrderTimelineEntry[];
}
