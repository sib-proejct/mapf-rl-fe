// Generated from Core auto-assignment.schema.json. Do not edit.
export const AUTO_ASSIGNMENT_VERSION = "1.0.0" as const;
export interface AutoAssignOrderRequest {
  requestId: string;
  mapId: string;
  mapRevision: number;
  goalColumn: number;
  goalRow: number;
  arrivalAction?: "PICK" | "PLACE" | "CHARGE" | null;
}
export interface AutoAssignOrderOutcome {
  requestId: string;
  orderId: string;
  state: "Submitted" | "Planning" | "Rejected";
  orderUpdateId: 0;
  robotId: string;
}
