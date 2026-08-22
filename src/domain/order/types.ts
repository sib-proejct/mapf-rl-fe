/**
 * Typed domain models for Order state and lifecycle.
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
}

export interface Order {
  id: string;
  orderUpdateId: number;
  planRevisionId?: string;
  state: OrderLifecycleState;
  assignments: OrderAssignment[];
  mapId?: string;
  mapRevision?: number;
  submittedAtUtc?: string;
  updatedAtUtc?: string;
}
